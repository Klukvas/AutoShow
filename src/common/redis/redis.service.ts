import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import type { AppConfig } from '../../config/config.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;
  public readonly subscriber: Redis;
  public readonly bullConnectionOptions: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
  };

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    const opts: RedisOptions = {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    this.client = new Redis(opts);
    this.subscriber = new Redis(opts);
    this.bullConnectionOptions = opts as typeof this.bullConnectionOptions;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}
