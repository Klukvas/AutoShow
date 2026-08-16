import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { CursorPage, decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { Listing } from '../listings/entities/listing.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Lead, type LeadDetails, type LeadStatus } from './entities/lead.entity';
import { LeadNote } from './entities/lead-note.entity';

const RATE_PREFIX = 'leads:rate:';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadNote) private readonly notes: Repository<LeadNote>,
    @InjectRepository(AdminUser) private readonly adminUsers: Repository<AdminUser>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    // Loud boot-time warning: a dealership that silently stops receiving lead
    // alerts loses deals, so a misconfigured pipeline must be visible in logs.
    if (!this.config.LEAD_NOTIFY_TO) {
      this.logger.warn(
        'LEAD_NOTIFY_TO is not set — new leads are stored but nobody is emailed about them',
      );
    } else if (!this.config.SMTP_HOST) {
      this.logger.warn(
        'LEAD_NOTIFY_TO is set but SMTP_HOST is not — lead notifications will only be logged, not delivered',
      );
    }
  }

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
      details: this.detailsFrom(dto),
      sourceUrl: dto.sourceUrl ?? null,
      utm: dto.utm ?? null,
      status: 'new',
      ipHash: ip ? this.hashIp(ip) : null,
      listingId: dto.listingId ?? null,
    });
    const saved = await this.leads.save(lead);

    const subject = `New lead [${dto.type}] from ${dto.name}`;
    const body = [
      `Type: ${dto.type}`,
      `Name: ${dto.name}`,
      `Phone: ${dto.phone}`,
      dto.email ? `Email: ${dto.email}` : null,
      // saved.message = structured sell/credit details + the visitor's text —
      // the raw dto.message would drop the car/credit info from the alert.
      saved.message ? `Message: ${saved.message}` : null,
      dto.sourceUrl ? `Source: ${dto.sourceUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (this.config.LEAD_NOTIFY_TO) {
      await this.notifications.enqueue('email', {
        to: this.config.LEAD_NOTIFY_TO,
        subject,
        body,
        meta: { leadId: saved.id },
      });
    }
    // Instant Telegram alert to the manager chat. The channel is a no-op when
    // site_settings.telegram.leadChatId is unset, so enqueuing unconditionally
    // is safe — leads are low-volume and the drained job is cheap.
    await this.notifications.enqueue('telegram', {
      to: 'telegram',
      subject,
      body,
      meta: { leadId: saved.id },
    });

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

  /** Assign a lead to a team member, or pass null to unassign. */
  async assign(id: string, assigneeId: string | null, actor: AuthenticatedUser): Promise<Lead> {
    const lead = await this.leads.findOne({ where: { id, deletedAt: IsNull() } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (assigneeId) {
      const user = await this.adminUsers.findOne({
        where: { id: assigneeId, isActive: true, deletedAt: IsNull() },
        select: ['id'],
      });
      if (!user) throw new NotFoundException('Assignee not found or inactive');
    }
    const previous = lead.assigneeId;
    const saved = await this.leads.save({ ...lead, assigneeId });
    await this.audit.record({
      action: 'lead.assign',
      entityType: 'lead',
      entityId: id,
      diff: { from: previous, to: assigneeId },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  /** Schedule (or clear, with null) a follow-up time for a lead. */
  async setFollowUp(id: string, followUpAt: Date | null, actor: AuthenticatedUser): Promise<Lead> {
    const lead = await this.leads.findOne({ where: { id, deletedAt: IsNull() } });
    if (!lead) throw new NotFoundException('Lead not found');
    const saved = await this.leads.save({ ...lead, followUpAt });
    await this.audit.record({
      action: 'lead.follow_up',
      entityType: 'lead',
      entityId: id,
      diff: { followUpAt: followUpAt?.toISOString() ?? null },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return saved;
  }

  /** Append an immutable note to the lead's touch history. */
  async addNote(id: string, text: string, actor: AuthenticatedUser): Promise<LeadNote> {
    const lead = await this.leads.findOne({
      where: { id, deletedAt: IsNull() },
      select: ['id'],
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const note = await this.notes.save(
      this.notes.create({ leadId: id, authorId: actor.id, authorRole: actor.role, text }),
    );
    await this.audit.record({
      action: 'lead.note',
      entityType: 'lead',
      entityId: id,
      diff: { noteId: note.id },
      actorId: actor.id,
      actorRole: actor.role,
    });
    return note;
  }

  /**
   * Active team members a lead can be assigned to (minimal projection so this
   * is safe for editors, who can't list full admin_users). id/email/role only.
   */
  async listAssignees(): Promise<{ id: string; email: string; role: string }[]> {
    const users = await this.adminUsers.find({
      where: { isActive: true, deletedAt: IsNull() },
      select: ['id', 'email', 'role'],
      order: { email: 'ASC' },
    });
    return users.map((u) => ({ id: u.id, email: u.email, role: u.role }));
  }

  /** Note thread for a lead, newest first. */
  async listNotes(id: string): Promise<LeadNote[]> {
    const lead = await this.leads.findOne({
      where: { id, deletedAt: IsNull() },
      select: ['id'],
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.notes.find({ where: { leadId: id }, order: { createdAt: 'DESC' } });
  }

  /**
   * Structured sell/credit payload for `details` (jsonb). Only the fields
   * relevant to the lead type are kept — a stray carYear on a callback lead
   * is dropped, not stored.
   */
  private detailsFrom(dto: CreateLeadDto): LeadDetails | null {
    const details: LeadDetails = {};
    if (dto.type === 'sell_request') {
      if (dto.carMake) details.carMake = dto.carMake;
      if (dto.carModel) details.carModel = dto.carModel;
      if (dto.carYear != null) details.carYear = dto.carYear;
      if (dto.carMileageKm != null) details.carMileageKm = dto.carMileageKm;
    }
    if (dto.type === 'credit') {
      if (dto.creditDownPayment != null) details.creditDownPayment = dto.creditDownPayment;
      if (dto.creditTermMonths != null) details.creditTermMonths = dto.creditTermMonths;
    }
    return Object.keys(details).length > 0 ? details : null;
  }

  /**
   * Human-readable rendering of the same sell/credit fields for the admin
   * inbox and email notifications. The machine-readable copy lives in
   * `details` (see detailsFrom) — this string is display-only.
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
