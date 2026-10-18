import { PhotoAiAccessService } from './photo-ai-access.service';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { PhotoAiSettings } from './entities/photo-ai-settings.entity';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { PhotoAiSettingsController } from './photo-ai-settings.controller';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PHOTO_AI_QUEUE } from '../../workers/queue.tokens';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ListingMedia } from '../listings/entities/listing-media.entity';
import { Listing } from '../listings/entities/listing.entity';
import { PhotoAiGeneration } from './entities/photo-ai-generation.entity';
import { PhotoAiPreset } from './entities/photo-ai-preset.entity';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiProvider } from './photo-ai.provider';
import { PhotoAiService } from './photo-ai.service';
import { PhotoCreditsService } from './photo-credits.service';
import { PhotoAiBalance } from './entities/photo-ai-balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ListingMedia,
      Listing,
      PhotoAiGeneration,
      PhotoAiPreset,
      PhotoAiSettings,
      PhotoAiBalance,
      AdminUser,
    ]),
    BullModule.registerQueue({ name: PHOTO_AI_QUEUE }),
    AiCredentialsModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [PhotoAiController, PhotoAiSettingsController],
  providers: [
    PhotoAiService,
    PhotoAiProvider,
    PhotoAiCredentialsService,
    PhotoAiAccessService,
    PhotoCreditsService,
  ],
  exports: [
    PhotoAiService,
    PhotoAiProvider,
    PhotoAiAccessService,
    PhotoCreditsService,
    TypeOrmModule,
  ],
})
export class PhotoAiModule {}
