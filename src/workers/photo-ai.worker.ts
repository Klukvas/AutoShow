import {
  PhotoAiAccessService,
  PHOTO_AI_ACCESS_DENIED,
} from '../modules/photo-ai/photo-ai-access.service';
import { ForbiddenException } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import sharp from 'sharp';
import { IsNull, LessThan, Repository } from 'typeorm';
import type { AppConfig } from '../config/config.module';
import { PhotoAiGeneration } from '../modules/photo-ai/entities/photo-ai-generation.entity';
import {
  PHOTO_AI_MAX_OUTPUT_BYTES,
  PHOTO_AI_MAX_PIXELS,
  PhotoAiProvider,
} from '../modules/photo-ai/photo-ai.provider';
import { PhotoAiService } from '../modules/photo-ai/photo-ai.service';
import {
  generationKeys,
  type PhotoAiManifest,
  type PhotoAiRendition,
} from '../modules/photo-ai/photo-ai.types';
import { StorageService } from '../modules/storage/storage.service';
import { PHOTO_AI_QUEUE } from './queue.tokens';

@Processor(PHOTO_AI_QUEUE, { concurrency: 1, maxStalledCount: 0 })
export class PhotoAiWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PhotoAiWorker.name);
  constructor(
    @InjectRepository(PhotoAiGeneration)
    private readonly generations: Repository<PhotoAiGeneration>,
    private readonly photos: PhotoAiService,
    private readonly provider: PhotoAiProvider,
    private readonly storage: StorageService,
    @InjectQueue(PHOTO_AI_QUEUE) private readonly queue: Queue,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly access: PhotoAiAccessService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler('photo-ai-recover', { every: 60_000 }, { name: 'recover' });
  }

  async process(job: Job<{ generationId: string }>): Promise<void> {
    if (job.name === 'recover') {
      await this.recover();
      return;
    }
    const row = await this.claim(job.data.generationId);
    if (!row) return;
    const keys = generationKeys(row.listingId, row.mediaId, row.id);
    try {
      await this.photos.liveMedia(this.generations.manager, row.mediaId);
      if (!row.outputStoredAt) {
        const head = await this.storage.head(row.sourceS3Key);
        if (!head || head.size > this.config.MEDIA_MAX_BYTES)
          throw new Error('Оригінал недоступний або завеликий.');
        const source = await this.storage.getBuffer(row.sourceS3Key);
        const image = await sharp(source, { limitInputPixels: PHOTO_AI_MAX_PIXELS })
          .rotate()
          .png()
          .toBuffer();
        if (image.length > this.config.MEDIA_MAX_BYTES)
          throw new Error('Оригінал завеликий для обробки.');
        await this.access.requireAllowed(row.actorId);
        // Paid intent and sold-state check share the listing lock. A committed
        // intent marks an already-dispatched request if the sale follows it.
        const intent = await this.generations.manager.transaction(async (em) => {
          await this.photos.liveMedia(em, row.mediaId, true);
          return em.update(
            PhotoAiGeneration,
            { id: row.id, status: 'processing', providerStartedAt: IsNull() },
            { providerStartedAt: new Date() },
          );
        });
        if (intent.affected !== 1) return;
        const output = await this.provider.edit(image, row.effectivePrompt, row.actorId);
        await this.storage.putBuffer(keys[0], output, 'image/png');
        await this.generations.update(
          { id: row.id, status: 'processing' },
          { outputStoredAt: new Date() },
        );
      }
      const manifest = await this.render(row, keys[0]);
      const kept = await this.generations.manager.transaction(async (em) => {
        try {
          await this.photos.liveMedia(em, row.mediaId, true);
        } catch {
          return false;
        }
        const result = await em.update(
          PhotoAiGeneration,
          { id: row.id, status: 'processing' },
          { status: 'ready', manifest, failureReason: null },
        );
        return result.affected === 1;
      });
      if (!kept) {
        await this.generations.update(
          { id: row.id, status: 'processing' },
          { status: 'interrupted', failureReason: 'Фото видалено під час обробки.' },
        );
        await this.discard(keys, row.id);
      }
    } catch (error) {
      // Never expose raw provider errors/headers. Intent without durable output
      // has an ambiguous paid outcome and requires an explicit new generation.
      const current = await this.generations.findOne({ where: { id: row.id } });
      const denied = error instanceof ForbiddenException;
      const interrupted = !denied && Boolean(current?.providerStartedAt && !current.outputStoredAt);
      await this.generations.update(
        { id: row.id, status: 'processing' },
        {
          status: interrupted ? 'interrupted' : 'failed',
          failureReason: denied
            ? PHOTO_AI_ACCESS_DENIED
            : interrupted
              ? 'Не вдалося підтвердити результат. Нове створення — окремий запит.'
              : 'Не вдалося підготувати фото. Спробуйте створити новий варіант.',
        },
      );
      await this.discard(keys, row.id);
      this.logger.warn({ generationId: row.id }, 'photo AI generation did not complete');
    }
  }

  private async claim(id: string): Promise<PhotoAiGeneration | null> {
    const changed = await this.generations.update(
      { id, status: 'queued' },
      { status: 'processing' },
    );
    if (changed.affected !== 1) return null;
    return this.generations.findOne({ where: { id, status: 'processing' } });
  }

  private async render(row: PhotoAiGeneration, outputKey: string): Promise<PhotoAiManifest> {
    const head = await this.storage.head(outputKey);
    if (!head || head.size > PHOTO_AI_MAX_OUTPUT_BYTES) throw new Error('invalid output size');
    const output = await this.storage.getBuffer(outputKey);
    const metadata = await sharp(output, { limitInputPixels: PHOTO_AI_MAX_PIXELS }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('invalid dimensions');
    const renditions: PhotoAiRendition[] = [];
    for (const [variant, width] of [
      ['thumb', 320],
      ['gallery', 960],
      ['full', 1920],
    ] as const) {
      for (const format of ['webp', 'avif', 'jpeg'] as const) {
        const { data, info } = await sharp(output, { limitInputPixels: PHOTO_AI_MAX_PIXELS })
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality: format === 'avif' ? 60 : 82 })
          .toBuffer({ resolveWithObject: true });
        const key = outputKey.replace('output.png', `${variant}.${format}`);
        await this.storage.putBuffer(key, data, `image/${format}`);
        renditions.push({
          variant,
          format,
          s3Key: key,
          width: info.width,
          height: info.height,
          sizeBytes: String(data.length),
        });
      }
    }
    // Disclosure derives from the immutable mode, not the editable prompt.
    return {
      generationId: row.id,
      s3Key: outputKey,
      width: metadata.width,
      height: metadata.height,
      sceneAltered: row.category === 'scene',
      renditions,
    };
  }

  private async discard(keys: string[], generationId: string): Promise<void> {
    const results = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));
    if (results.some((result) => result.status === 'rejected'))
      this.logger.warn('photo AI cleanup deferred to recovery');
    else await this.generations.update({ id: generationId }, { artifactsCleanedAt: new Date() });
  }

  async recover(): Promise<void> {
    const terminal = await this.generations.find({
      where: [
        {
          status: 'failed',
          artifactsCleanedAt: IsNull(),
          updatedAt: LessThan(
            new Date(Date.now() - (this.config.PHOTO_AI_TIMEOUT_SECONDS + 300) * 1000),
          ),
        },
        {
          status: 'interrupted',
          artifactsCleanedAt: IsNull(),
          updatedAt: LessThan(
            new Date(Date.now() - (this.config.PHOTO_AI_TIMEOUT_SECONDS + 300) * 1000),
          ),
        },
      ],
      take: 100,
    });
    for (const row of terminal)
      await this.discard(generationKeys(row.listingId, row.mediaId, row.id), row.id);
    const queued = await this.generations.find({ where: { status: 'queued' }, take: 100 });
    for (const row of queued) await this.photos.enqueue(row.id);
    const stale = await this.generations.find({
      where: {
        status: 'processing',
        updatedAt: LessThan(
          new Date(Date.now() - (this.config.PHOTO_AI_TIMEOUT_SECONDS + 120) * 1000),
        ),
      },
      take: 100,
    });
    for (const row of stale) {
      try {
        await this.photos.liveMedia(this.generations.manager, row.mediaId);
      } catch {
        await this.generations.update(
          { id: row.id, status: 'processing' },
          { status: 'interrupted', failureReason: 'Фото видалено під час обробки.' },
        );
        await this.discard(generationKeys(row.listingId, row.mediaId, row.id), row.id);
        continue;
      }
      // A successful upload followed by a crash before the DB write is also
      // recoverable. Never issue another provider request for persisted intent.
      const key = generationKeys(row.listingId, row.mediaId, row.id)[0];
      const head = await this.storage.head(key);
      if (head && head.size <= PHOTO_AI_MAX_OUTPUT_BYTES) {
        const old = await this.queue.getJob(`photo-ai-${row.id}`);
        if (old && (await old.getState()) === 'active') continue;
        if (old) await old.remove();
        await this.generations.update(
          { id: row.id, status: 'processing' },
          { status: 'queued', outputStoredAt: row.outputStoredAt ?? new Date() },
        );
        await this.photos.enqueue(row.id);
      } else {
        await this.generations.update(
          { id: row.id, status: 'processing' },
          {
            status: 'interrupted',
            failureReason:
              'Обробку перервано. Попередній запит міг бути оброблений. Нове створення — окремий запит.',
          },
        );
      }
    }
  }
}
