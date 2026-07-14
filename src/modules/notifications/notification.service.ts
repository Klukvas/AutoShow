import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../../workers/queue.tokens';
import type { NotificationPayload } from './notification-channel';

export interface QueuedNotification extends NotificationPayload {
  channelId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<QueuedNotification>) {}

  async enqueue(channelId: string, payload: NotificationPayload): Promise<void> {
    await this.queue.add(
      'send',
      { channelId, ...payload },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
    this.logger.debug({ channelId, to: payload.to }, 'Notification queued');
  }
}
