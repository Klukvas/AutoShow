import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../modules/notifications/notification.module';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { Listing } from '../modules/listings/entities/listing.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { MaintenanceWorker } from './maintenance.worker';
import { MediaProcessorWorker } from './media-processor.worker';
import { NotificationWorker } from './notification.worker';
import { MAINTENANCE_QUEUE, MEDIA_QUEUE, NOTIFICATION_QUEUE, VIEWS_QUEUE } from './queue.tokens';
import { ViewsFlushWorker } from './views-flush.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([ListingMedia, MediaRendition, Listing]),
    NotificationModule,
    BullModule.registerQueue(
      { name: MEDIA_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: VIEWS_QUEUE },
      { name: MAINTENANCE_QUEUE },
    ),
  ],
  providers: [MediaProcessorWorker, NotificationWorker, ViewsFlushWorker, MaintenanceWorker],
})
export class WorkersModule {}
