import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { NotificationChannel } from '../modules/notifications/notification-channel';
import type { QueuedNotification } from '../modules/notifications/notification.service';
import { NOTIFICATION_QUEUE } from './queue.tokens';

@Processor(NOTIFICATION_QUEUE)
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    @Inject('NOTIFICATION_CHANNELS')
    private readonly channels: Map<string, NotificationChannel>,
  ) {
    super();
  }

  async process(job: Job<QueuedNotification>): Promise<void> {
    const { channelId, ...payload } = job.data;
    const channel = this.channels.get(channelId);
    if (!channel) {
      this.logger.warn({ channelId }, 'unknown notification channel, dropping job');
      return;
    }
    await channel.send(payload);
  }
}
