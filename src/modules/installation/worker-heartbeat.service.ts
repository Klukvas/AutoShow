import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {}
  onModuleInit(): void {
    void this.beat();
    this.timer = setInterval(() => void this.beat(), 30_000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  private async beat(): Promise<void> {
    try {
      await this.redis.client.set(
        `installation:${this.config.INSTALLATION_ID}:worker`,
        this.config.APP_VERSION,
        'EX',
        90,
      );
    } catch {
      this.logger.warn('Worker heartbeat unavailable');
    }
  }
}
