import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { In, LessThan, Not, IsNull, Repository } from 'typeorm';
import type { AppConfig } from '../config/config.module';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { StorageService } from '../modules/storage/storage.service';
import { MAINTENANCE_QUEUE } from './queue.tokens';

const REPEAT_KEY = 'orphan-cleanup';
const SWEEP_EVERY_MS = 60 * 60 * 1000;

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceWorker.name);

  constructor(
    @InjectRepository(ListingMedia)
    private readonly media: Repository<ListingMedia>,
    @InjectRepository(MediaRendition)
    private readonly renditions: Repository<MediaRendition>,
    private readonly storage: StorageService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      REPEAT_KEY,
      { every: SWEEP_EVERY_MS },
      { name: REPEAT_KEY },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === REPEAT_KEY) {
      await this.cleanupOrphans();
      await this.cleanupSoftDeleted();
    }
  }

  /**
   * Uploads that were never confirmed: they stay status='pending' forever
   * (confirm() moves images to 'processing'), so anything still 'pending' past
   * the TTL is a genuine orphan. Confirmed-but-still-queued media are NEVER
   * 'pending', so they are safe from this sweep.
   */
  private async cleanupOrphans(): Promise<void> {
    const cutoff = new Date(Date.now() - this.config.MEDIA_ORPHAN_TTL_HOURS * 60 * 60 * 1000);
    const stale = await this.media.find({
      where: { status: 'pending', createdAt: LessThan(cutoff), deletedAt: IsNull() },
      take: 500,
    });
    for (const media of stale) {
      try {
        await this.storage.delete(media.originalS3Key);
        await this.media.delete({ id: media.id });
      } catch (err) {
        this.logger.warn({ err, mediaId: media.id }, 'orphan media cleanup failed');
      }
    }
    if (stale.length) {
      this.logger.log({ count: stale.length }, 'orphan media swept');
    }
  }

  /**
   * Media rows soft-deleted along with their listing: reclaim their S3 objects
   * (original + every rendition), then hard-delete the rows so storage doesn't
   * leak for the lifetime of the bucket.
   */
  private async cleanupSoftDeleted(): Promise<void> {
    const stale = await this.media.find({
      withDeleted: true,
      where: { deletedAt: Not(IsNull()) },
      take: 500,
    });
    if (!stale.length) return;
    const mediaIds = stale.map((m) => m.id);
    const renditions = await this.renditions.find({
      withDeleted: true,
      where: { mediaId: In(mediaIds) },
    });

    let removed = 0;
    for (const media of stale) {
      const keys = [
        media.originalS3Key,
        ...renditions.filter((r) => r.mediaId === media.id).map((r) => r.s3Key),
      ];
      try {
        await Promise.all(keys.map((key) => this.storage.delete(key)));
        await this.renditions.delete({ mediaId: media.id });
        await this.media.delete({ id: media.id });
        removed += 1;
      } catch (err) {
        this.logger.warn({ err, mediaId: media.id }, 'soft-deleted media cleanup failed');
      }
    }
    if (removed) {
      this.logger.log({ count: removed }, 'soft-deleted media reclaimed');
    }
  }
}
