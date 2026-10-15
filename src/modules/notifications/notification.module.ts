import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NOTIFICATION_QUEUE } from '../../workers/queue.tokens';
import { SiteSettings } from '../branding/entities/site-settings.entity';
import { TelegramApiClient } from '../telegram/telegram-api.client';
import type { NotificationChannel } from './notification-channel';
import { NotificationService } from './notification.service';
import { TelegramLeadChannel } from './telegram-channel';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    // SiteSettings repo lets the Telegram channel read the bot token/lead chat
    // at send time. TelegramApiClient is a stateless wrapper, so we provide our
    // own instance here rather than importing TelegramModule (which would pull
    // in the whole publishing chain — Branding/Audit/Auth — into the worker).
    TypeOrmModule.forFeature([SiteSettings]),
  ],
  providers: [
    NotificationService,
    TelegramApiClient,
    TelegramLeadChannel,
    {
      provide: 'NOTIFICATION_CHANNELS',
      useFactory: (telegram: TelegramLeadChannel) =>
        new Map<string, NotificationChannel>([[telegram.id, telegram]]),
      inject: [TelegramLeadChannel],
    },
  ],
  exports: [NotificationService, 'NOTIFICATION_CHANNELS'],
})
export class NotificationModule {}
