import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../config/config.module';
import { ViewCounterService } from '../modules/views/view-counter.service';
import { VIEWS_QUEUE } from './queue.tokens';

@Processor(VIEWS_QUEUE)
export class ViewsFlushWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ViewsFlushWorker.name);

  constructor(
    private readonly counter: ViewCounterService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectQueue(VIEWS_QUEUE) private readonly queue: Queue,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler replaces any existing 'views-flush' schedule, so
    // changing VIEW_FLUSH_INTERVAL_SECONDS doesn't leave a stale repeatable job
    // running forever alongside the new one.
    await this.queue.upsertJobScheduler(
      'views-flush',
      { every: this.config.VIEW_FLUSH_INTERVAL_SECONDS * 1000 },
      { name: 'flush', opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }

  async process(_job: Job): Promise<void> {
    const updates = await this.counter.drain();
    if (!updates.length) return;
    try {
      await this.ds.transaction(async (manager) => {
        for (const { listingId, delta } of updates) {
          await manager.query('UPDATE listings SET views_count = views_count + $2 WHERE id = $1', [
            listingId,
            delta,
          ]);
        }
      });
      this.logger.debug({ count: updates.length }, 'views flushed');
    } catch (err) {
      await this.counter.restore(updates);
      throw err;
    }
  }
}
