import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { In, MoreThan, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LISTING_AI_QUEUE } from '../../workers/queue.tokens';
import { AuditLogService } from '../audit/audit-log.service';
import { lockWritableListing } from '../listings/writable-listing';
import { ListingAiGeneration } from './entities/listing-ai-generation.entity';
import { ListingAiAccessService, LISTING_AI_UNAVAILABLE } from './listing-ai-access.service';
import { ListingAiCreditsService } from './listing-ai-credits.service';
import { ListingAiInputService } from './listing-ai-input.service';
import { LISTING_AI_PROMPT_VERSION } from './listing-ai.prompts';
import type { ListingAiPreset } from './listing-ai.types';

export type CreateListingAiDraft = { requestId: string; preset: ListingAiPreset };

/** Creates drafts: one paid provider call each, queued for the worker. */
@Injectable()
export class ListingAiService {
  private readonly logger = new Logger(ListingAiService.name);

  constructor(
    @InjectRepository(ListingAiGeneration)
    private readonly generations: Repository<ListingAiGeneration>,
    @InjectQueue(LISTING_AI_QUEUE) private readonly queue: Queue<{ generationId: string }>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly inputs: ListingAiInputService,
    private readonly access: ListingAiAccessService,
    private readonly credits: ListingAiCreditsService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Idempotent twice over: a repeated requestId returns its own row, and an
   * identical draft (same listing data and preset) already in flight is
   * returned instead of paying for a second one.
   */
  async create(
    listingId: string,
    dto: CreateListingAiDraft,
    actor: AuthenticatedUser,
  ): Promise<ListingAiGeneration> {
    await this.access.requireAllowed(actor.id);
    // A client retry is answered before the (relation-heavy) snapshot is built.
    const earlier = await this.generations.findOne({
      where: { actorId: actor.id, requestId: dto.requestId },
    });
    if (earlier) return this.repeatOf(earlier, listingId, dto);
    const snapshot = await this.inputs.snapshot(listingId);
    const row = await this.generations.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`listing-ai:${actor.id}`]);
      const repeated = await em.findOne(ListingAiGeneration, {
        where: { actorId: actor.id, requestId: dto.requestId },
      });
      if (repeated) return this.repeatOf(repeated, listingId, dto);
      if (!(await this.access.available()))
        throw new ServiceUnavailableException(LISTING_AI_UNAVAILABLE);
      // Listing lock: a sale or deletion cannot slip between this check and the insert.
      await lockWritableListing(em, listingId).catch((error: unknown) => {
        throw error instanceof ForbiddenException
          ? new ForbiddenException('Продане оголошення не можна змінювати.')
          : error;
      });
      const inFlight = await em.findOne(ListingAiGeneration, {
        where: {
          listingId,
          inputHash: snapshot.inputHash,
          preset: dto.preset,
          status: In(['queued', 'processing']),
        },
      });
      if (inFlight) {
        // Another draft for the same data is already paid for and running. It is
        // shared, so this request's own id is not stored: record who asked.
        await this.audit.record(
          {
            action: 'listing_ai.generate_reused',
            entityType: 'listing',
            entityId: listingId,
            actorId: actor.id,
            actorRole: actor.role,
            diff: { generationId: inFlight.id, preset: dto.preset },
          },
          em,
        );
        return inFlight;
      }
      const recent = await em.count(ListingAiGeneration, {
        where: { actorId: actor.id, createdAt: MoreThan(new Date(Date.now() - 3600_000)) },
      });
      if (recent >= this.config.LISTING_AI_JOBS_PER_HOUR)
        throw new HttpException('Ліміт генерацій вичерпано. Спробуйте пізніше.', 429);
      const created = await em.save(
        ListingAiGeneration,
        em.create(ListingAiGeneration, {
          listingId,
          actorId: actor.id,
          requestId: dto.requestId,
          preset: dto.preset,
          inputHash: snapshot.inputHash,
          inputSnapshot: { input: snapshot.input, photos: snapshot.photos },
          photoMediaIds: snapshot.photos.map((photo) => photo.mediaId),
          promptVersion: LISTING_AI_PROMPT_VERSION,
          model: this.config.LISTING_AI_MODEL,
          status: 'queued',
        }),
      );
      // Managed mode: hold one description (402 and rollback when none is left).
      await this.credits.reserve(em, created.id, actor);
      await this.audit.record(
        {
          action: 'listing_ai.generate',
          entityType: 'listing',
          entityId: listingId,
          actorId: actor.id,
          actorRole: actor.role,
          diff: { generationId: created.id, preset: dto.preset },
        },
        em,
      );
      return created;
    });
    if (row.status === 'queued') await this.enqueueQuietly(row.id);
    return row;
  }

  private repeatOf(
    row: ListingAiGeneration,
    listingId: string,
    dto: CreateListingAiDraft,
  ): ListingAiGeneration {
    if (row.listingId !== listingId || row.preset !== dto.preset)
      throw new ConflictException('Цей запит уже використано з іншими налаштуваннями.');
    return row;
  }

  /** The durable row is the outbox: the worker's recovery sweep repairs a failed enqueue. */
  private async enqueueQuietly(id: string): Promise<void> {
    try {
      await this.enqueue(id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn({ generationId: id, reason }, 'listing AI enqueue deferred to recovery');
    }
  }

  async enqueue(id: string): Promise<void> {
    const old = await this.queue.getJob(`listing-ai-${id}`);
    if (old) {
      const state = await old.getState();
      if (state === 'failed' || state === 'completed') await old.remove();
      else return;
    }
    await this.queue.add(
      'generate',
      { generationId: id },
      { jobId: `listing-ai-${id}`, attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }
}
