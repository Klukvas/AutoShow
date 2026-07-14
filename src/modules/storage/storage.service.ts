import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { AppConfig } from '../../config/config.module';

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly presignTtl: number;

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    this.bucket = config.S3_BUCKET;
    this.publicUrl = config.S3_PUBLIC_URL.replace(/\/$/, '');
    this.presignTtl = config.S3_PRESIGNED_PUT_TTL;
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      // AWS SDK v3 (>=3.729) computes a checksum at PUT-command build time and,
      // for presigned URLs, hoists the CRC32 of the EMPTY presign-time body into
      // the signed query string. The browser then PUTs real bytes whose checksum
      // no longer matches and S3 rejects it. Only add checksums when explicitly
      // required so presigned uploads work.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async presignPut(opts: {
    key: string;
    contentType: string;
    maxBytes: number;
  }): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ContentLength: opts.maxBytes,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: this.presignTtl });
    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${opts.key}`,
      key: opts.key,
      expiresIn: this.presignTtl,
    };
  }

  publicUrlFor(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: Number(res.ContentLength ?? 0),
        contentType: res.ContentType,
      };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      this.logger.warn({ err, key }, 'HEAD failed');
      throw err;
    }
  }

  /** Read the first `length` bytes of an object (for magic-byte sniffing). */
  async getRange(key: string, length: number): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
    );
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async putBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
