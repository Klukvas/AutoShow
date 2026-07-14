import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MEDIA_QUEUE } from '../../workers/queue.tokens';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { Listing } from '../listings/entities/listing.entity';
import { MediaRendition } from '../listings/entities/media-rendition.entity';
import { MediaAdminController } from './media-admin.controller';
import { MediaService } from './media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ListingMedia, MediaRendition, Listing]),
    BullModule.registerQueue({ name: MEDIA_QUEUE }),
    AuditModule,
    AuthModule,
  ],
  controllers: [MediaAdminController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
