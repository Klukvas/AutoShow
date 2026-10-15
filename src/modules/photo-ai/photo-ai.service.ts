import { PhotoAiAccessService } from './photo-ai-access.service';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { lockWritableListing } from '../listings/writable-listing';
import { Listing } from '../listings/entities/listing.entity';
import { StorageService } from '../storage/storage.service';
import { PHOTO_AI_QUEUE } from '../../workers/queue.tokens';
import { PhotoAiGeneration } from './entities/photo-ai-generation.entity';
import { PhotoAiPreset } from './entities/photo-ai-preset.entity';
import type { ApplyPhotoAiDto, GeneratePhotoAiDto, SavePhotoAiPresetDto } from './photo-ai.dto';
import { BUILTIN_PHOTO_PRESETS, protectedPrompt } from './photo-ai.prompts';
import { PhotoAiProvider } from './photo-ai.provider';
import { generationKeys } from './photo-ai.types';

@Injectable()
export class PhotoAiService {
  private readonly logger = new Logger(PhotoAiService.name);
  constructor(
    @InjectRepository(PhotoAiGeneration)
    private readonly generations: Repository<PhotoAiGeneration>,
    @InjectRepository(PhotoAiPreset) private readonly presets: Repository<PhotoAiPreset>,
    @InjectQueue(PHOTO_AI_QUEUE) private readonly queue: Queue<{ generationId: string }>,
    private readonly provider: PhotoAiProvider,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly access: PhotoAiAccessService,
  ) {}

  async liveMedia(em: EntityManager, mediaId: string, lock = false): Promise<ListingMedia> {
    // Lock order is always listing -> media, matching listing deletion.
    const ref = await em.findOne(ListingMedia, { where: { id: mediaId, deletedAt: IsNull() } });
    if (!ref) throw new NotFoundException('Фото не знайдено.');
    const listing = lock
      ? await lockWritableListing(em, ref.listingId)
      : await em.findOne(Listing, {
          where: { id: ref.listingId, deletedAt: IsNull() },
          ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
        });
    if (!listing) throw new NotFoundException('Оголошення не знайдено.');
    const media = await em.findOne(ListingMedia, {
      where: { id: mediaId, deletedAt: IsNull() },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!media) throw new NotFoundException('Фото не знайдено.');
    if (media.type !== 'image' || media.status !== 'ready')
      throw new BadRequestException('Доступно лише для готових фото.');
    return media;
  }

  async workspace(mediaId: string, actor: AuthenticatedUser) {
    const permission = await this.access.permission(actor.id);
    if (!permission.permitted) return permission;
    const media = await this.liveMedia(this.generations.manager, mediaId);
    const recent = await this.generations.find({
      where: { mediaId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const activeId = media.activeAiVariant?.generationId;
    const active =
      activeId && !recent.some((g) => g.id === activeId)
        ? await this.generations.findOne({ where: { id: activeId, mediaId, status: 'ready' } })
        : null;
    const history = active ? [...recent, active] : recent;
    return {
      ...permission,
      ...(await this.provider.availability()),
      mediaId,
      revision: media.aiRevision,
      activeGenerationId: media.activeAiVariant?.generationId ?? null,
      originalUrl: this.storage.publicUrlFor(media.originalS3Key),
      history: history.map((g) => this.generationView(g)),
      builtins: BUILTIN_PHOTO_PRESETS,
      presets: await this.presets.find({
        where: { actorId: actor.id },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    };
  }

  generationView(g: PhotoAiGeneration) {
    return {
      id: g.id,
      category: g.category,
      prompt: g.prompt,
      status: g.status,
      failureReason: g.failureReason,
      createdAt: g.createdAt,
      sceneAltered: g.manifest?.sceneAltered ?? g.category === 'scene',
      previewUrl: g.manifest ? this.storage.publicUrlFor(g.manifest.s3Key) : null,
    };
  }

  async generate(mediaId: string, dto: GeneratePhotoAiDto, actor: AuthenticatedUser) {
    await this.access.requireAllowed(actor.id);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([mediaId, dto.category, dto.prompt]))
      .digest('hex');
    const row = await this.generations.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`photo-ai:${actor.id}`]);
      const existing = await em.findOne(PhotoAiGeneration, {
        where: { actorId: actor.id, requestId: dto.requestId },
      });
      if (existing) {
        await this.liveMedia(em, mediaId);
        if (existing.fingerprint !== fingerprint)
          throw new ConflictException('Цей запит уже використано з іншими налаштуваннями.');
        return existing;
      }
      if (!(await this.provider.availability()).enabled)
        throw new ServiceUnavailableException('Обробка ШІ поки недоступна.');
      const media = await this.liveMedia(em, mediaId, true);
      const active = await em
        .createQueryBuilder(PhotoAiGeneration, 'g')
        .where('g.media_id = :mediaId AND g.status IN (:...statuses)', {
          mediaId,
          statuses: ['queued', 'processing'],
        })
        .getOne();
      if (active) throw new ConflictException('Це фото вже обробляється.');
      const count = await em.count(PhotoAiGeneration, {
        where: { actorId: actor.id, createdAt: MoreThan(new Date(Date.now() - 3600_000)) },
      });
      if (count >= this.config.PHOTO_AI_JOBS_PER_HOUR)
        throw new HttpException('Ліміт створення фото вичерпано. Спробуйте пізніше.', 429);
      const row = await em.save(
        PhotoAiGeneration,
        em.create(PhotoAiGeneration, {
          mediaId,
          listingId: media.listingId,
          actorId: actor.id,
          requestId: dto.requestId,
          fingerprint,
          category: dto.category,
          prompt: dto.prompt,
          effectivePrompt: protectedPrompt(dto.prompt, dto.category),
          sourceS3Key: media.originalS3Key,
          status: 'queued',
        }),
      );
      await this.audit.record(
        {
          action: 'photo_ai.generate',
          entityType: 'listing_media',
          entityId: mediaId,
          actorId: actor.id,
          actorRole: actor.role,
          diff: { generationId: row.id, category: dto.category },
        },
        em,
      );
      return row;
    });
    if (row.status === 'queued') {
      // Durable row is the outbox: the worker sweep repairs enqueue failures.
      try {
        await this.enqueue(row.id);
      } catch {
        this.logger.warn({ generationId: row.id }, 'photo AI enqueue deferred to recovery');
      }
    }
    return this.generationView(row);
  }

  async enqueue(id: string): Promise<void> {
    const old = await this.queue.getJob(`photo-ai-${id}`);
    if (old) {
      const state = await old.getState();
      if (state === 'failed' || state === 'completed') await old.remove();
      else return;
    }
    await this.queue.add(
      'generate',
      { generationId: id },
      { jobId: `photo-ai-${id}`, attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }

  async apply(mediaId: string, dto: ApplyPhotoAiDto, actor: AuthenticatedUser) {
    await this.access.requireAllowed(actor.id);
    if (!dto.reviewed)
      throw new BadRequestException('Спочатку перевірте деталі авто на результаті.');
    return this.generations.manager.transaction(async (em) => {
      const media = await this.liveMedia(em, mediaId, true);
      const row = await em.findOne(PhotoAiGeneration, {
        where: { id: dto.generationId, mediaId, status: 'ready' },
      });
      if (!row?.manifest) throw new BadRequestException('Варіант ще не готовий.');
      if (media.activeAiVariant?.generationId === row.id)
        return { revision: media.aiRevision, activeGenerationId: row.id };
      this.assertRevision(media, dto.expectedRevision);
      await em.update(
        ListingMedia,
        { id: mediaId },
        { activeAiVariant: row.manifest, aiRevision: media.aiRevision + 1 },
      );
      await this.audit.record(
        {
          action: 'photo_ai.apply',
          entityType: 'listing_media',
          entityId: mediaId,
          actorId: actor.id,
          actorRole: actor.role,
          diff: { generationId: row.id, sceneAltered: row.manifest.sceneAltered },
        },
        em,
      );
      return { revision: media.aiRevision + 1, activeGenerationId: row.id };
    });
  }

  async restore(mediaId: string, revision: number, actor: AuthenticatedUser) {
    await this.access.requireAllowed(actor.id);
    return this.generations.manager.transaction(async (em) => {
      const media = await this.liveMedia(em, mediaId, true);
      if (!media.activeAiVariant) return { revision: media.aiRevision, activeGenerationId: null };
      this.assertRevision(media, revision);
      await em.update(
        ListingMedia,
        { id: mediaId },
        { activeAiVariant: null, aiRevision: media.aiRevision + 1 },
      );
      await this.audit.record(
        {
          action: 'photo_ai.restore',
          entityType: 'listing_media',
          entityId: mediaId,
          actorId: actor.id,
          actorRole: actor.role,
        },
        em,
      );
      return { revision: media.aiRevision + 1, activeGenerationId: null };
    });
  }

  private assertRevision(media: ListingMedia, expected: number): void {
    if (media.aiRevision !== expected)
      throw new ConflictException(
        'Фото змінив інший користувач. Оновіть історію та повторіть дію.',
      );
  }

  async savePreset(dto: SavePhotoAiPresetDto, actor: AuthenticatedUser) {
    await this.access.requireAllowed(actor.id);
    return this.presets.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`photo-ai:${actor.id}`]);
      if ((await em.count(PhotoAiPreset, { where: { actorId: actor.id } })) >= 50)
        throw new BadRequestException('Можна зберегти до 50 пресетів.');
      return em.save(PhotoAiPreset, em.create(PhotoAiPreset, { ...dto, actorId: actor.id }));
    });
  }

  /** Tombstones retain generation identities until late uploads cannot arrive. */
  async cleanupKeys(media: ListingMedia): Promise<string[]> {
    const rows = await this.generations.find({ where: { mediaId: media.id }, withDeleted: true });
    return rows.flatMap((g) => generationKeys(g.listingId, g.mediaId, g.id));
  }
  async safeToReclaim(mediaId: string): Promise<boolean> {
    const grace = (this.config.PHOTO_AI_TIMEOUT_SECONDS + 300) * 1000;
    return !(await this.generations.findOne({
      where: [
        { mediaId, updatedAt: MoreThan(new Date(Date.now() - grace)) },
        { mediaId, createdAt: MoreThan(new Date(Date.now() - 3600_000)) },
      ],
      withDeleted: true,
    }));
  }
}
