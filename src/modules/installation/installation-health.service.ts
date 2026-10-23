import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { statfs } from 'node:fs/promises';
import Redis from 'ioredis';
import { Client } from 'pg';
import type { AppConfig } from '../../config/config.module';

@Injectable()
export class InstallationHealthService {
  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  async check(): Promise<Record<'database' | 'redis' | 'storage' | 'worker' | 'disk', boolean>> {
    const database = new Client({
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_APP_USER,
      password: this.config.DB_APP_PASSWORD,
      connectionTimeoutMillis: 1500,
      query_timeout: 2000,
    });
    database.on('error', () => undefined);
    const redis = new Redis({
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      password: this.config.REDIS_PASSWORD || undefined,
      db: this.config.REDIS_DB,
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 2000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // Probe failures are represented by booleans; never echo SDK connection errors.
    redis.on('error', () => undefined);
    const storage = new S3Client({
      endpoint: this.config.S3_ENDPOINT,
      region: this.config.S3_REGION,
      forcePathStyle: this.config.S3_FORCE_PATH_STYLE,
      maxAttempts: 1,
      credentials: {
        accessKeyId: this.config.S3_ACCESS_KEY,
        secretAccessKey: this.config.S3_SECRET_KEY,
      },
    });
    const safe = async (probe: () => Promise<unknown>): Promise<boolean> => {
      try {
        return Boolean(await probe());
      } catch {
        return false;
      }
    };
    try {
      const [databaseOk, redisOk, storageOk, worker, disk] = await Promise.all([
        safe(async () => {
          await database.connect();
          await database.query('SELECT 1');
          return true;
        }),
        safe(async () => (await redis.ping()) === 'PONG'),
        safe(async () => {
          await storage.send(new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }), {
            abortSignal: AbortSignal.timeout(2000),
          });
          return true;
        }),
        safe(
          async () =>
            (await redis.get(`installation:${this.config.INSTALLATION_ID}:worker`)) ===
            this.config.APP_VERSION,
        ),
        safe(async () => {
          const fs = await statfs(process.cwd());
          return fs.bavail * fs.bsize >= this.config.HEALTH_MIN_FREE_MB * 1024 * 1024;
        }),
      ]);
      return { database: databaseOk, redis: redisOk, storage: storageOk, worker, disk };
    } finally {
      redis.disconnect();
      storage.destroy();
      await database.end().catch(() => undefined);
    }
  }
}
