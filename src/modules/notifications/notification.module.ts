import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATION_QUEUE } from '../../workers/queue.tokens';
import { EmailChannel } from './email-channel';
import { NotificationService } from './notification.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  providers: [
    NotificationService,
    EmailChannel,
    {
      provide: 'NOTIFICATION_CHANNELS',
      useFactory: (email: EmailChannel) => new Map([[email.id, email]]),
      inject: [EmailChannel],
    },
  ],
  exports: [NotificationService, 'NOTIFICATION_CHANNELS', EmailChannel],
})
export class NotificationModule {}
