import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LISTING_AI_QUEUE } from '../../workers/queue.tokens';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { AiTextModule } from '../ai-text/ai-text.module';
import { AuditModule } from '../audit/audit.module';
import { Listing } from '../listings/entities/listing.entity';
import { ListingAiBalance } from './entities/listing-ai-balance.entity';
import { ListingAiGeneration } from './entities/listing-ai-generation.entity';
import { ListingAiSettings } from './entities/listing-ai-settings.entity';
import { ListingAiAccessService } from './listing-ai-access.service';
import { ListingAiCreditsService } from './listing-ai-credits.service';
import { ListingAiInputService } from './listing-ai-input.service';
import { ListingAiService } from './listing-ai.service';

/** AI listing descriptions: input, drafts, access, credits. The HTTP API comes next. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      AdminUser,
      ListingAiGeneration,
      ListingAiSettings,
      ListingAiBalance,
    ]),
    BullModule.registerQueue({ name: LISTING_AI_QUEUE }),
    AiCredentialsModule,
    AiTextModule,
    AuditModule,
  ],
  providers: [
    ListingAiInputService,
    ListingAiAccessService,
    ListingAiCreditsService,
    ListingAiService,
  ],
  exports: [
    ListingAiInputService,
    ListingAiAccessService,
    ListingAiCreditsService,
    ListingAiService,
    AiTextModule,
    TypeOrmModule,
  ],
})
export class ListingAiModule {}
