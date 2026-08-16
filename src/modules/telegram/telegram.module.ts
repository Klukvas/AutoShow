import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TELEGRAM_QUEUE } from '../../workers/queue.tokens';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BrandingModule } from '../branding/branding.module';
import { Listing } from '../listings/entities/listing.entity';
import { ListingTelegramPost } from './entities/listing-telegram-post.entity';
import { TelegramAdminController } from './telegram-admin.controller';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramPostService } from './telegram-post.service';

/**
 * Telegram channel publishing. Uses the Listing REPOSITORY (not
 * ListingsModule — ListingsService depends on this module for the publish/
 * mark-sold hooks, so importing it back would be a cycle). StorageService
 * comes from the global StorageModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ListingTelegramPost, Listing]),
    BullModule.registerQueue({ name: TELEGRAM_QUEUE }),
    BrandingModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [TelegramAdminController],
  providers: [TelegramApiClient, TelegramPostService],
  exports: [TelegramPostService],
})
export class TelegramModule {}
