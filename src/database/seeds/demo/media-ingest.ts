import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import type { DataSource } from 'typeorm';
import { ListingMedia } from '../../../modules/listings/entities/listing-media.entity';
import {
  MediaRendition,
  type RenditionFormat,
  type RenditionVariant,
} from '../../../modules/listings/entities/media-rendition.entity';

/**
 * Seed-time media ingestion. Mirrors MediaProcessorWorker output exactly
 * (same key layout, variants and formats) but runs inline so the seed does
 * not depend on Redis/BullMQ or a running worker process.
 */

const VARIANTS: ReadonlyArray<{ variant: RenditionVariant; maxWidth: number }> = [
  { variant: 'thumb', maxWidth: 320 },
  { variant: 'gallery', maxWidth: 960 },
  { variant: 'full', maxWidth: 1920 },
];

const FORMATS: ReadonlyArray<{ format: RenditionFormat; mime: string; quality: number }> = [
  { format: 'webp', mime: 'image/webp', quality: 82 },
  { format: 'avif', mime: 'image/avif', quality: 60 },
  { format: 'jpeg', mime: 'image/jpeg', quality: 85 },
];

export interface SeedStorage {
  readonly client: S3Client;
  readonly bucket: string;
}

export function createSeedStorage(): SeedStorage {
  const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`missing required S3 env vars: ${missing.join(', ')}`);
  }
  return {
    bucket: process.env.S3_BUCKET as string,
    client: new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY as string,
        secretAccessKey: process.env.S3_SECRET_KEY as string,
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    }),
  };
}

async function putObject(
  storage: SeedStorage,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await storage.client.send(
    new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export interface IngestPhotoInput {
  readonly listingId: string;
  readonly photo: Buffer;
  readonly position: number;
  readonly isCover: boolean;
  readonly alt: string;
}

/**
 * Uploads the original, generates all renditions and persists media rows in
 * 'ready' state — the exact shape the upload flow + worker would produce.
 */
export async function ingestListingPhoto(
  ds: DataSource,
  storage: SeedStorage,
  input: IngestPhotoInput,
): Promise<void> {
  const metadata = await sharp(input.photo).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('cannot read image dimensions');
  }

  const originalKey = `listings/${input.listingId}/original/${nanoid(16)}.jpg`;
  await putObject(storage, originalKey, input.photo, 'image/jpeg');

  const mediaRepo = ds.getRepository(ListingMedia);
  const media = await mediaRepo.save(
    mediaRepo.create({
      listingId: input.listingId,
      type: 'image',
      originalS3Key: originalKey,
      status: 'ready',
      width: metadata.width,
      height: metadata.height,
      sizeBytes: String(input.photo.length),
      mime: 'image/jpeg',
      position: input.position,
      isCover: input.isCover,
      alt: input.alt,
    }),
  );

  const baseKey = originalKey.replace(/\.[^./]+$/, '').replace('/original/', '/r/');
  const combos = VARIANTS.flatMap((variant) =>
    FORMATS.map((format) => ({ ...variant, ...format })),
  );

  const renditionRepo = ds.getRepository(MediaRendition);
  const renditions = await Promise.all(
    combos.map(async (combo) => {
      const targetWidth = Math.min(metadata.width as number, combo.maxWidth);
      const pipeline = sharp(input.photo)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true });
      let buffer: Buffer;
      if (combo.format === 'webp') buffer = await pipeline.webp({ quality: combo.quality }).toBuffer();
      else if (combo.format === 'avif')
        buffer = await pipeline.avif({ quality: combo.quality }).toBuffer();
      else buffer = await pipeline.jpeg({ quality: combo.quality, mozjpeg: true }).toBuffer();

      const renditionMeta = await sharp(buffer).metadata();
      const key = `${baseKey}/${combo.variant}.${combo.format}`;
      await putObject(storage, key, buffer, combo.mime);

      return renditionRepo.create({
        mediaId: media.id,
        variant: combo.variant,
        format: combo.format,
        s3Key: key,
        width: renditionMeta.width ?? targetWidth,
        height:
          renditionMeta.height ??
          Math.round((targetWidth / (metadata.width as number)) * (metadata.height as number)),
        sizeBytes: String(buffer.length),
      });
    }),
  );
  await renditionRepo.save(renditions);
}
