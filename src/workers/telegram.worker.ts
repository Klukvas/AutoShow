import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { TelegramPostService, type TelegramJob } from '../modules/telegram/telegram-post.service';
import { TELEGRAM_QUEUE } from './queue.tokens';

/**
 * Executes Telegram channel jobs. Default concurrency (1) is intentional:
 * jobs for the same listing then run sequentially, so a duplicate enqueue
 * can't race past the per-(listing, chat) idempotency rows.
 */
@Processor(TELEGRAM_QUEUE)
export class TelegramWorker extends WorkerHost {
  private readonly logger = new Logger(TelegramWorker.name);

  constructor(private readonly telegram: TelegramPostService) {
    super();
  }

  async process(job: Job<TelegramJob>): Promise<void> {
    switch (job.name) {
      case 'post':
        await this.telegram.postListing(job.data.listingId);
        return;
      case 'mark-sold':
        await this.telegram.markSoldPosts(job.data.listingId);
        return;
      default:
        this.logger.warn({ name: job.name }, 'unknown telegram job, dropping');
    }
  }
}
