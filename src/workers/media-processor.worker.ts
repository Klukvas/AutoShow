import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { IsNull, Repository } from 'typeorm';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { StorageService } from '../modules/storage/storage.service';
import { MEDIA_QUEUE } from './queue.tokens';

interface MediaProcessJob {
  mediaId: string;
}

const VARIANTS: Array<{ variant: 'thumb' | 'gallery' | 'full'; maxWidth: number }> = [
  { variant: 'thumb', maxWidth: 320 },
  { variant: 'gallery', maxWidth: 960 },
  { variant: 'full', maxWidth: 1920 },
];

const FORMATS: Array<{ format: 'webp' | 'avif' | 'jpeg'; mime: string; quality: number }> = [
  { format: 'webp', mime: 'image/webp', quality: 82 },
  { format: 'avif', mime: 'image/avif', quality: 60 },
  { format: 'jpeg', mime: 'image/jpeg', quality: 85 },
];

@Processor(MEDIA_QUEUE)
export class MediaProcessorWorker extends WorkerHost {
  private readonly logger = new Logger(MediaProcessorWorker.name);

  constructor(
    @InjectRepository(ListingMedia)
    private readonly media: Repository<ListingMedia>,
    @InjectRepository(MediaRendition)
    private readonly renditions: Repository<MediaRendition>,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<MediaProcessJob>): Promise<void> {
    const { mediaId } = job.data;
    const media = await this.media.findOne({ where: { id: mediaId, deletedAt: IsNull() } });
    if (!media) {
      this.logger.warn({ mediaId }, 'media not found, dropping job');
      return;
    }
    if (media.status === 'ready') return;

    try {
      const original = await this.storage.getBuffer(media.originalS3Key);
      const metadata = await sharp(original).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('cannot read image dimensions');
      }

      const baseKey = media.originalS3Key.replace(/\.[^./]+$/, '').replace('/original/', '/r/');
      const renditionsToCreate: MediaRendition[] = [];

      for (const variant of VARIANTS) {
        const targetWidth = Math.min(metadata.width, variant.maxWidth);
        for (const format of FORMATS) {
          const pipeline = sharp(original)
            .rotate()
            .resize({ width: targetWidth, withoutEnlargement: true });
          let buffer: Buffer;
          if (format.format === 'webp')
            buffer = await pipeline.webp({ quality: format.quality }).toBuffer();
          else if (format.format === 'avif')
            buffer = await pipeline.avif({ quality: format.quality }).toBuffer();
          else buffer = await pipeline.jpeg({ quality: format.quality, mozjpeg: true }).toBuffer();

          const renditionMeta = await sharp(buffer).metadata();
          const key = `${baseKey}/${variant.variant}.${format.format}`;
          await this.storage.putBuffer(key, buffer, format.mime);

          renditionsToCreate.push(
            this.renditions.create({
              mediaId,
              variant: variant.variant,
              format: format.format,
              s3Key: key,
              width: renditionMeta.width ?? targetWidth,
              height:
                renditionMeta.height ??
                Math.round((targetWidth / metadata.width) * metadata.height),
              sizeBytes: String(buffer.length),
            }),
          );
        }
      }

      // Flip to 'ready' only if the media is still alive; the affected-rows
      // count gates whether we persist renditions. If remove() soft-deleted the
      // row while we were processing, we compensate by deleting the S3 objects
      // we just uploaded instead of resurrecting them.
      const flip = await this.media.update(
        { id: mediaId, deletedAt: IsNull() },
        {
          status: 'ready',
          width: metadata.width,
          height: metadata.height,
          sizeBytes: String(original.length),
          mime: metadata.format ? `image/${metadata.format}` : media.mime,
          failureReason: null,
        },
      );
      if (flip.affected !== 1) {
        this.logger.warn({ mediaId }, 'media removed mid-processing, discarding renditions');
        await Promise.all(
          renditionsToCreate.map((r) => this.storage.delete(r.s3Key).catch(() => undefined)),
        );
        return;
      }

      await this.renditions.delete({ mediaId });
      if (renditionsToCreate.length) await this.renditions.save(renditionsToCreate);
      this.logger.log({ mediaId, count: renditionsToCreate.length }, 'media processed');
    } catch (err) {
      this.logger.error({ err, mediaId }, 'media processing failed');
      await this.media.update(
        { id: mediaId },
        {
          status: 'failed',
          failureReason: err instanceof Error ? err.message.slice(0, 510) : 'unknown error',
        },
      );
      throw err;
    }
  }
}
