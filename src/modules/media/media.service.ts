import { PhotoAiService } from '../photo-ai/photo-ai.service';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { nanoid } from 'nanoid';
import { EntityManager, IsNull, Repository } from 'typeorm';
import type { AppConfig } from '../../config/config.module';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { lockWritableListing } from '../listings/writable-listing';
import { Listing } from '../listings/entities/listing.entity';
import { MediaRendition } from '../listings/entities/media-rendition.entity';
import { StorageService } from '../storage/storage.service';
import { MEDIA_QUEUE } from '../../workers/queue.tokens';
import { CreateMediaDto, MEDIA_EXTENSIONS } from './dto/create-media.dto';

export interface MediaProcessJob {
  mediaId: string;
}

class PersistedMediaFailure extends Error {
  constructor(readonly original: unknown) {
    super('Media failure persisted');
  }
}

const jobIdFor = (mediaId: string) => `media-${mediaId}`;

// Magic-byte prefixes we accept for video confirms. mp4/mov both carry an
// 'ftyp' box at offset 4; we don't trust the client Content-Type alone.
function looksLikeVideo(head: Buffer): boolean {
  return head.length >= 12 && head.toString('ascii', 4, 8) === 'ftyp';
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(ListingMedia)
    private readonly media: Repository<ListingMedia>,
    @InjectRepository(MediaRendition)
    private readonly renditions: Repository<MediaRendition>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue<MediaProcessJob>,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly photos: PhotoAiService,
  ) {}

  async beginUpload(listingId: string, dto: CreateMediaDto) {
    return this.media.manager.transaction(async (em) => {
      await lockWritableListing(em, listingId);
      return this.beginUploadLocked(listingId, dto, em);
    });
  }

  private async beginUploadLocked(listingId: string, dto: CreateMediaDto, em: EntityManager) {
    if (dto.sizeBytes > this.config.MEDIA_MAX_BYTES) {
      throw new BadRequestException('file too large');
    }
    if (!dto.contentType.startsWith(`${dto.type}/`)) {
      throw new BadRequestException('media type does not match content type');
    }
    const listing = await em.getRepository(Listing).findOne({
      where: { id: listingId, deletedAt: IsNull() },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const ext = MEDIA_EXTENSIONS[dto.contentType];
    const key = `listings/${listingId}/original/${nanoid(16)}.${ext}`;

    const presigned = await this.storage.presignPut({
      key,
      contentType: dto.contentType,
      maxBytes: dto.sizeBytes,
    });

    const row = em.getRepository(ListingMedia).create({
      listingId,
      type: dto.type,
      originalS3Key: key,
      status: 'pending',
      mime: dto.contentType,
      sizeBytes: String(dto.sizeBytes),
      position: 0,
    });
    const saved = await em.getRepository(ListingMedia).save(row);
    return {
      mediaId: saved.id,
      uploadUrl: presigned.uploadUrl,
      key,
      expiresIn: presigned.expiresIn,
    };
  }

  async confirm(mediaId: string, actor: AuthenticatedUser): Promise<ListingMedia> {
    return this.commitMediaWrite(async (em) => {
      const ref = await em.findOne(ListingMedia, { where: { id: mediaId, deletedAt: IsNull() } });
      if (!ref) throw new NotFoundException('Media not found');
      await lockWritableListing(em, ref.listingId);
      return this.confirmLocked(mediaId, actor, em);
    });
  }

  private async confirmLocked(
    mediaId: string,
    actor: AuthenticatedUser,
    em: EntityManager,
  ): Promise<ListingMedia> {
    const media = await em.getRepository(ListingMedia).findOne({
      where: { id: mediaId, deletedAt: IsNull() },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (media.status === 'ready') return media;
    if (media.status === 'failed') throw new BadRequestException('media is in failed state');

    const head = await this.storage.head(media.originalS3Key);
    if (!head) {
      throw new BadRequestException('upload not found in storage');
    }
    if (head.size > this.config.MEDIA_MAX_BYTES) {
      media.status = 'failed';
      media.failureReason = 'file exceeds size limit';
      await em.getRepository(ListingMedia).save(media);
      throw new BadRequestException('upload exceeds size limit');
    }
    const actualContentType = head.contentType?.split(';', 1)[0]?.trim().toLowerCase();
    if (
      !actualContentType ||
      actualContentType !== media.mime?.toLowerCase() ||
      !actualContentType.startsWith(`${media.type}/`)
    ) {
      media.status = 'failed';
      media.failureReason = 'uploaded content type does not match requested media type';
      await em.getRepository(ListingMedia).save(media);
      throw new BadRequestException('uploaded content type does not match requested media type');
    }

    if (media.type === 'image') {
      // Move off 'pending' BEFORE enqueuing so the orphan sweep can never
      // reclaim a confirmed-but-still-queued upload.
      media.status = 'processing';
      await em.getRepository(ListingMedia).save(media);
      await this.enqueueProcess(media.id);
    } else {
      // Don't trust the client Content-Type alone: sniff the container's magic
      // bytes before marking a video ready.
      const magic = await this.storage
        .getRange(media.originalS3Key, 12)
        .catch(() => Buffer.alloc(0));
      if (!looksLikeVideo(magic)) {
        media.status = 'failed';
        media.failureReason = 'uploaded bytes are not a recognized video container';
        await em.getRepository(ListingMedia).save(media);
        throw new BadRequestException('uploaded file is not a valid video');
      }
      media.status = 'ready';
      media.sizeBytes = String(head.size);
      await em.getRepository(ListingMedia).save(media);
    }

    await this.audit.record(
      {
        action: 'media.confirm',
        entityType: 'listing_media',
        entityId: media.id,
        actorId: actor.id,
        actorRole: actor.role,
        diff: { listingId: media.listingId, type: media.type },
      },
      em,
    );
    return media;
  }

  /**
   * Re-run rendition processing for an image that ended in 'failed' (transient
   * worker error, sharp hiccup). Videos aren't reprocessable — a failed video
   * failed magic-byte validation and needs a fresh upload. Verifies the
   * original is still in storage before requeuing.
   */
  async retry(mediaId: string, actor: AuthenticatedUser): Promise<ListingMedia> {
    return this.commitMediaWrite(async (em) => {
      const ref = await em.findOne(ListingMedia, { where: { id: mediaId, deletedAt: IsNull() } });
      if (!ref) throw new NotFoundException('Media not found');
      await lockWritableListing(em, ref.listingId);
      return this.retryLocked(mediaId, actor, em);
    });
  }

  private async retryLocked(
    mediaId: string,
    actor: AuthenticatedUser,
    em: EntityManager,
  ): Promise<ListingMedia> {
    const media = await em
      .getRepository(ListingMedia)
      .findOne({ where: { id: mediaId, deletedAt: IsNull() } });
    if (!media) throw new NotFoundException('Media not found');
    if (media.type !== 'image') {
      throw new BadRequestException('only image media can be reprocessed');
    }
    if (media.status !== 'failed') {
      throw new BadRequestException('only failed media can be retried');
    }
    const head = await this.storage.head(media.originalS3Key);
    if (!head) {
      throw new BadRequestException('original upload is no longer in storage — re-upload the file');
    }
    media.status = 'processing';
    media.failureReason = null;
    await em.getRepository(ListingMedia).save(media);
    // A prior failed job may still linger (removeOnFail keeps it briefly);
    // drop it so the same jobId can be re-added.
    await this.queue.remove(jobIdFor(media.id)).catch(() => undefined);
    try {
      await this.enqueueProcess(media.id);
    } catch (err) {
      // If enqueue fails (Redis/BullMQ down) after we flipped to 'processing',
      // the row would be stuck forever (retry requires status='failed', and the
      // orphan sweep ignores 'processing'). Roll back so it can be retried.
      media.status = 'failed';
      media.failureReason = 'failed to schedule reprocessing';
      await em.getRepository(ListingMedia).save(media);
      throw new PersistedMediaFailure(err);
    }
    await this.audit.record(
      {
        action: 'media.retry',
        entityType: 'listing_media',
        entityId: media.id,
        actorId: actor.id,
        actorRole: actor.role,
      },
      em,
    );
    return media;
  }

  private async commitMediaWrite(
    operation: (em: EntityManager) => Promise<ListingMedia>,
  ): Promise<ListingMedia> {
    const result = await this.media.manager.transaction(async (em) => {
      try {
        return await operation(em);
      } catch (error) {
        // Expected validation/scheduling failures already saved their durable failed state.
        if (error instanceof BadRequestException || error instanceof PersistedMediaFailure)
          return error;
        throw error;
      }
    });
    if (result instanceof PersistedMediaFailure) throw result.original;
    if (result instanceof BadRequestException) throw result;
    return result;
  }

  private async enqueueProcess(mediaId: string): Promise<void> {
    await this.queue.add(
      'process',
      { mediaId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        jobId: jobIdFor(mediaId),
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  async reorder(listingId: string, ids: string[], actor: AuthenticatedUser): Promise<void> {
    return this.media.manager.transaction(async (em) => {
      await lockWritableListing(em, listingId);
      return this.reorderLocked(listingId, ids, actor, em);
    });
  }

  private async reorderLocked(
    listingId: string,
    ids: string[],
    actor: AuthenticatedUser,
    em: EntityManager,
  ): Promise<void> {
    const all = await em
      .getRepository(ListingMedia)
      .find({ where: { listingId, deletedAt: IsNull() } });
    const allowed = new Set(all.map((m) => m.id));
    const requested = new Set(ids);
    // Require a complete, duplicate-free permutation of the listing's live
    // media so we never leave half-applied orderings or duplicate positions.
    if (requested.size !== ids.length) {
      throw new BadRequestException('media order contains duplicate ids');
    }
    if (requested.size !== allowed.size || ids.some((id) => !allowed.has(id))) {
      throw new BadRequestException(
        'media order must be a complete permutation of the listing media',
      );
    }
    await em.getRepository(ListingMedia).manager.transaction(async (em) => {
      await Promise.all(
        ids.map((id, idx) => em.update(ListingMedia, { id, listingId }, { position: idx })),
      );
    });
    await this.audit.record(
      {
        action: 'media.reorder',
        entityType: 'listing',
        entityId: listingId,
        actorId: actor.id,
        actorRole: actor.role,
        diff: { order: ids },
      },
      em,
    );
  }

  async setCover(listingId: string, mediaId: string, actor: AuthenticatedUser): Promise<void> {
    return this.media.manager.transaction(async (em) => {
      await lockWritableListing(em, listingId);
      return this.setCoverLocked(listingId, mediaId, actor, em);
    });
  }

  private async setCoverLocked(
    listingId: string,
    mediaId: string,
    actor: AuthenticatedUser,
    em: EntityManager,
  ): Promise<void> {
    const media = await em.getRepository(ListingMedia).findOne({
      where: { id: mediaId, listingId, deletedAt: IsNull() },
    });
    if (!media) throw new NotFoundException('Media not found');
    // Single atomic statement — combined with the partial unique index
    // (listing_id) WHERE is_cover, this guarantees exactly one cover.
    await em
      .getRepository(ListingMedia)
      .query(
        `UPDATE listing_media SET is_cover = (id = $2) WHERE listing_id = $1 AND deleted_at IS NULL`,
        [listingId, mediaId],
      );
    await this.audit.record(
      {
        action: 'media.set_cover',
        entityType: 'listing',
        entityId: listingId,
        actorId: actor.id,
        actorRole: actor.role,
        diff: { mediaId },
      },
      em,
    );
  }

  async remove(mediaId: string, actor: AuthenticatedUser): Promise<void> {
    const media = await this.media.manager.transaction(async (em) => {
      const ref = await em.findOne(ListingMedia, { where: { id: mediaId, deletedAt: IsNull() } });
      if (!ref) throw new NotFoundException('Media not found');
      await lockWritableListing(em, ref.listingId);
      const live = await em.findOne(ListingMedia, {
        where: { id: mediaId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!live) throw new NotFoundException('Media not found');
      await em.softDelete(ListingMedia, { id: mediaId });
      return live;
    });
    // Cancel any in-flight/queued processing job first, otherwise the worker
    // can resurrect rendition rows and re-upload S3 objects we just deleted.
    await this.queue.remove(jobIdFor(mediaId)).catch(() => undefined);
    const renditions = await this.renditions.find({
      where: { mediaId, deletedAt: IsNull() },
    });
    const keys = [
      media.originalS3Key,
      ...renditions.map((rendition) => rendition.s3Key),
      ...(await this.photos.cleanupKeys(media)),
    ];
    try {
      await Promise.all(keys.map((key) => this.storage.delete(key)));
    } catch (err) {
      this.logger.warn({ err, mediaId }, 'failed to delete media from storage');
      // The durable deletion already succeeded. Maintenance retries storage
      // cleanup; reporting failure would invite a retry against a deleted row.
    }
    if (renditions.length) await this.renditions.softDelete({ mediaId });

    await this.audit.record({
      action: 'media.delete',
      entityType: 'listing_media',
      entityId: mediaId,
      actorId: actor.id,
      actorRole: actor.role,
    });
  }
}
