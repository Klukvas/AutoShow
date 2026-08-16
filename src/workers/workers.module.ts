import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { Listing } from '../modules/listings/entities/listing.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { MaintenanceWorker } from './maintenance.worker';
import { MediaProcessorWorker } from './media-processor.worker';
import { NotificationWorker } from './notification.worker';
import { MAINTENANCE_QUEUE, MEDIA_QUEUE, NOTIFICATION_QUEUE, VIEWS_QUEUE } from './queue.tokens';
import { TelegramWorker } from './telegram.worker';
import { ViewsFlushWorker } from './views-flush.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([ListingMedia, MediaRendition, Listing]),
    CatalogModule,
    NotificationModule,
    TelegramModule,
    BullModule.registerQueue(
      { name: MEDIA_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: VIEWS_QUEUE },
      { name: MAINTENANCE_QUEUE },
    ),
  ],
  providers: [
    MediaProcessorWorker,
    NotificationWorker,
    ViewsFlushWorker,
    MaintenanceWorker,
    TelegramWorker,
  ],
})
export class WorkersModule {}
