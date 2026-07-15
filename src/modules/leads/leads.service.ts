import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { CursorPage, decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { Listing } from '../listings/entities/listing.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Lead, type LeadStatus } from './entities/lead.entity';

const RATE_PREFIX = 'leads:rate:';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async create(dto: CreateLeadDto, ip: string | undefined): Promise<Lead> {
    if (dto.website) {
      // Honeypot hit — bots fill the hidden `website` field. Accept *silently*
      // with a fabricated success response: telling them they failed lets them
      // adapt their template. We log it and return a believable shape without
      // persisting or notifying anyone.
      this.logger.warn({ ip, phone: dto.phone }, 'Honeypot triggered — silently dropped');
      // Byte-identical to a real success (`{ id, status: 'new' }`) so bots can't
      // detect the trap. Nothing is persisted or notified.
      return {
        id: randomUUID(),
        status: 'new',
      } as Lead;
    }
    await this.rateLimit(dto.phone, ip);

    if (dto.listingId) {
      // Reserved cars still take inquiries (deal may fall through); sold ones
      // don't — their page hides the form and direct POSTs get a 404.
      const listing = await this.listings.findOne({
        where: { id: dto.listingId, status: In(['published', 'reserved']), deletedAt: IsNull() },
        select: ['id'],
      });
      if (!listing) throw new NotFoundException('Listing not found');
    }

    const lead = this.leads.create({
      type: dto.type,
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      message: this.composeMessage(dto),
      sourceUrl: dto.sourceUrl ?? null,
      utm: dto.utm ?? null,
      status: 'new',
      ipHash: ip ? this.hashIp(ip) : null,
      listingId: dto.listingId ?? null,
    });
    const saved = await this.leads.save(lead);

    if (this.config.LEAD_NOTIFY_TO) {
      const subject = `New lead [${dto.type}] from ${dto.name}`;
      const body = [
        `Type: ${dto.type}`,
        `Name: ${dto.name}`,
        `Phone: ${dto.phone}`,
        dto.email ? `Email: ${dto.email}` : null,
        dto.message ? `Message: ${dto.message}` : null,
        dto.sourceUrl ? `Source: ${dto.sourceUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      await this.notifications.enqueue('email', {
        to: this.config.LEAD_NOTIFY_TO,
        subject,
        body,
        meta: { leadId: saved.id },
      });
    }

    return saved;
  }

  async list(opts: {
    status?: LeadStatus;
    cursor?: string;
    limit?: number;
  }): Promise<CursorPage<Lead>> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const qb = this.leads
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.listing', 'listing')
      .where('lead.deleted_at IS NULL')
      .orderBy('lead.created_at', 'DESC')
      .addOrderBy('lead.id', 'DESC');
    if (opts.status) qb.andWhere('lead.status = :status', { status: opts.status });
    // Total matching the filters, independent of the cursor window — the admin
    // UI needs it for the "N нових" badge and pagination summary.
    const total = await qb.clone().getCount();
    if (opts.cursor) {
      const cursor = decodeCursor(opts.cursor);
      if (cursor) {
        qb.andWhere('(lead.created_at, lead.id) < (:ck, :ci)', { ck: cursor.k, ci: cursor.i });
      }
    }
    qb.limit(limit + 1);
    const rows = await qb.getMany();
    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ k: last.createdAt.toISOString(), i: last.id });
    }
    return { items, nextCursor, total };
  }

  async updateStatus(id: string, status: LeadStatus, actor: AuthenticatedUser): Promise<Lead> {
    const lead = await this.leads.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const previous = lead.status;
    const saved = await this.leads.save({ ...lead, status });
    await this.audit.record({
      action: 'lead.status_change',
      entityType: 'lead',
      entityId: id,
      diff: { from: previous, to: status },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  /**
   * Folds the structured sell/credit fields into the free-text message so the
   * admin inbox and email notifications show everything without schema
   * changes. Validation stays strict on the DTO side.
   */
  private composeMessage(dto: CreateLeadDto): string | null {
    const details: string[] = [];
    if (dto.type === 'sell_request') {
      if (dto.carMake || dto.carModel) {
        details.push(`Авто: ${[dto.carMake, dto.carModel].filter(Boolean).join(' ')}`);
      }
      if (dto.carYear) details.push(`Рік: ${dto.carYear}`);
      if (dto.carMileageKm != null) {
        details.push(`Пробіг: ${dto.carMileageKm.toLocaleString('uk-UA')} км`);
      }
    }
    if (dto.type === 'credit') {
      if (dto.creditDownPayment != null) {
        details.push(`Перший внесок: ${dto.creditDownPayment.toLocaleString('uk-UA')}`);
      }
      if (dto.creditTermMonths) details.push(`Строк: ${dto.creditTermMonths} міс`);
    }
    const parts = [details.join(' · ') || null, dto.message?.trim() || null].filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : null;
  }

  private async rateLimit(phone: string, ip: string | undefined): Promise<void> {
    const limit = this.config.LEAD_RATE_PER_HOUR;
    const normalizedPhone = phone.replace(/\D/g, '');
    const keys = [
      ip ? `${RATE_PREFIX}ip:${ip}` : null,
      `${RATE_PREFIX}phone:${normalizedPhone}`,
    ].filter((k): k is string => Boolean(k));

    for (const key of keys) {
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, 3600);
      if (count > limit) {
        this.logger.warn({ key, count }, 'Lead rate limit exceeded');
        throw new ForbiddenException('Too many submissions. Please try again later.');
      }
    }
  }

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }
}
