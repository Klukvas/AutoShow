import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { IsNull, LessThan, Repository } from 'typeorm';
import type { AppConfig } from '../config/config.module';
import {
  TEXT_AI_PROVIDER,
  TextAiError,
  type TextAiImage,
  type TextAiProvider,
  type TextAiUsage,
} from '../modules/ai-text/text-ai.provider';
import { lockWritableListing } from '../modules/listings/writable-listing';
import { ListingAiGeneration } from '../modules/listing-ai/entities/listing-ai-generation.entity';
import {
  LISTING_AI_ACCESS_DENIED,
  LISTING_AI_UNAVAILABLE,
  ListingAiAccessService,
} from '../modules/listing-ai/listing-ai-access.service';
import { ListingAiCreditsService } from '../modules/listing-ai/listing-ai-credits.service';
import type { ListingAiPhoto } from '../modules/listing-ai/listing-ai.input';
import {
  LISTING_AI_SCHEMA,
  listingAiInstructions,
  listingAiUserText,
} from '../modules/listing-ai/listing-ai.prompts';
import {
  ListingAiResultError,
  parseListingAiResult,
} from '../modules/listing-ai/listing-ai.result';
import { ListingAiService } from '../modules/listing-ai/listing-ai.service';
import { validateListingAiResult } from '../modules/listing-ai/listing-ai.validate';
import { StorageService } from '../modules/storage/storage.service';
import { LISTING_AI_QUEUE } from './queue.tokens';

const MIME_BY_EXTENSION: Record<string, TextAiImage['mime']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const RECOVERY_SLACK_SECONDS = 120;
const LISTING_GONE = 'Оголошення видалено або продано під час генерації.';
const UNCONFIRMED = 'Не вдалося підтвердити результат. Нова генерація — окремий запит.';

/** Runs queued description drafts: one paid provider call per draft, never retried. */
@Processor(LISTING_AI_QUEUE, { concurrency: 2, maxStalledCount: 0 })
export class ListingAiWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ListingAiWorker.name);

  constructor(
    @InjectRepository(ListingAiGeneration)
    private readonly generations: Repository<ListingAiGeneration>,
    @Inject(TEXT_AI_PROVIDER) private readonly provider: TextAiProvider,
    private readonly drafts: ListingAiService,
    private readonly access: ListingAiAccessService,
    private readonly credits: ListingAiCreditsService,
    private readonly storage: StorageService,
    @InjectQueue(LISTING_AI_QUEUE) private readonly queue: Queue,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'listing-ai-recover',
      { every: 60_000 },
      { name: 'recover' },
    );
  }

  async process(job: Job<{ generationId: string }>): Promise<void> {
    if (job.name === 'recover') {
      await this.recover();
      return;
    }
    const row = await this.claim(job.data.generationId);
    if (!row) return;
    try {
      await this.generate(row);
    } finally {
      // Charge only a `ready` draft; every other ending gives the description back.
      await this.settleQuietly(row.id);
    }
  }

  private async claim(id: string): Promise<ListingAiGeneration | null> {
    const changed = await this.generations.update(
      { id, status: 'queued' },
      { status: 'processing' },
    );
    if (changed.affected !== 1) return null;
    return this.generations.findOne({ where: { id, status: 'processing' } });
  }

  private async generate(row: ListingAiGeneration): Promise<void> {
    try {
      await this.access.requireAllowed(row.actorId);
      if (!(await this.access.available())) throw new Error(LISTING_AI_UNAVAILABLE);
      const images = await this.loadImages(row.inputSnapshot.photos);
      if (!(await this.markProviderStarted(row.id, row.listingId))) return;
      const response = await this.provider.generate({
        model: row.model,
        instructions: listingAiInstructions(row.preset),
        text: listingAiUserText(row.inputSnapshot.input, images.length),
        images,
        schemaName: 'listing_description',
        schema: LISTING_AI_SCHEMA as unknown as Record<string, unknown>,
        maxOutputTokens: this.config.LISTING_AI_MAX_OUTPUT_TOKENS,
        timeoutMs: this.config.LISTING_AI_TIMEOUT_SECONDS * 1000,
      });
      let result;
      try {
        result = parseListingAiResult(response.output);
      } catch (error) {
        // The answer was billed even though it is unusable: keep its metrics.
        await this.fail(row.id, error, response);
        return;
      }
      const validation = validateListingAiResult(result, row.inputSnapshot.input, row.preset);
      await this.generations.update(
        { id: row.id, status: 'processing' },
        { status: 'ready', result, validation, failureReason: null, ...this.metrics(response) },
      );
    } catch (error) {
      await this.fail(row.id, error);
    }
  }

  /**
   * Records the paid intent under the listing lock, so a sale or deletion
   * that lands first stops the call and one that lands after it is detected.
   */
  private async markProviderStarted(id: string, listingId: string): Promise<boolean> {
    try {
      const intent = await this.generations.manager.transaction(async (em) => {
        await lockWritableListing(em, listingId);
        return em.update(
          ListingAiGeneration,
          { id, status: 'processing', providerStartedAt: IsNull() },
          { providerStartedAt: new Date() },
        );
      });
      return intent.affected === 1;
    } catch (error) {
      // Anything but a gone or sold listing (e.g. a DB hiccup) is left to the
      // caller's failure path; no paid call has been made yet either way.
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) throw error;
      await this.generations.update(
        { id, status: 'processing' },
        { status: 'failed', failureReason: LISTING_GONE },
      );
      return false;
    }
  }

  /** Photos are impression only: a missing one is skipped, not fatal. */
  private async loadImages(photos: readonly ListingAiPhoto[]): Promise<TextAiImage[]> {
    const loaded = await Promise.all(
      photos.map(async ({ s3Key }): Promise<TextAiImage | null> => {
        const mime = MIME_BY_EXTENSION[s3Key.split('.').pop()?.toLowerCase() ?? ''];
        if (!mime) return null;
        try {
          const head = await this.storage.head(s3Key);
          if (!head || head.size > this.config.MEDIA_MAX_BYTES) return null;
          return { mime, data: await this.storage.getBuffer(s3Key) };
        } catch {
          return null;
        }
      }),
    );
    return loaded.filter((image): image is TextAiImage => image !== null);
  }

  private metrics(usage: TextAiUsage) {
    const inPrice = this.config.LISTING_AI_INPUT_USD_PER_MTOK;
    const outPrice = this.config.LISTING_AI_OUTPUT_USD_PER_MTOK;
    const known = usage.inputTokens !== null && usage.outputTokens !== null;
    const cost =
      known && inPrice !== undefined && outPrice !== undefined
        ? ((usage.inputTokens as number) * inPrice + (usage.outputTokens as number) * outPrice) /
          1e6
        : null;
    return {
      model: usage.model.slice(0, 64),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: usage.latencyMs,
      costUsd: cost === null ? null : cost.toFixed(6),
    };
  }

  /** Users see a safe message; logs keep the kind and detail, never prompt text or keys. */
  private async fail(id: string, error: unknown, billed?: TextAiUsage): Promise<void> {
    const reason =
      error instanceof ForbiddenException
        ? LISTING_AI_ACCESS_DENIED
        : error instanceof TextAiError || error instanceof ListingAiResultError
          ? error.message
          : error instanceof Error && error.message === LISTING_AI_UNAVAILABLE
            ? LISTING_AI_UNAVAILABLE
            : 'Не вдалося створити опис. Спробуйте ще раз.';
    const paid = billed ?? (error instanceof TextAiError ? error.usage : undefined);
    const usage = paid ? this.metrics(paid) : {};
    await this.generations.update(
      { id, status: 'processing' },
      { status: 'failed', failureReason: reason, ...usage },
    );
    this.logger.warn(
      {
        generationId: id,
        kind:
          error instanceof TextAiError
            ? error.kind
            : error instanceof Error
              ? error.name
              : 'unknown',
        detail:
          error instanceof TextAiError || error instanceof ListingAiResultError
            ? error.detail
            : undefined,
      },
      'listing AI draft did not complete',
    );
  }

  private async settleQuietly(generationId: string): Promise<void> {
    try {
      const current = await this.generations.findOne({
        where: { id: generationId },
        withDeleted: true,
      });
      await this.credits.settle(generationId, current?.status ?? null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn({ generationId, reason }, 'listing AI settlement deferred to recovery');
    }
  }

  async recover(): Promise<void> {
    try {
      await this.recoverGenerations();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error({ reason }, 'listing AI recovery failed');
    } finally {
      await this.credits.sweep();
    }
  }

  private async recoverGenerations(): Promise<void> {
    const queued = await this.generations.find({ where: { status: 'queued' }, take: 100 });
    for (const row of queued) await this.drafts.enqueue(row.id);
    const staleBefore = new Date(
      Date.now() - (this.config.LISTING_AI_TIMEOUT_SECONDS + RECOVERY_SLACK_SECONDS) * 1000,
    );
    const stale = await this.generations.find({
      where: { status: 'processing', updatedAt: LessThan(staleBefore) },
      take: 100,
    });
    for (const row of stale) {
      const job = await this.queue.getJob(`listing-ai-${row.id}`);
      if (job && (await job.getState()) === 'active') continue;
      // A crash after the paid call has an unknown outcome: never call again silently.
      await this.generations.update(
        { id: row.id, status: 'processing' },
        row.providerStartedAt
          ? { status: 'interrupted', failureReason: UNCONFIRMED }
          : { status: 'queued' },
      );
      if (!row.providerStartedAt) await this.drafts.enqueue(row.id);
    }
  }
}
