import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Lead } from '../leads/entities/lead.entity';
import { Listing } from '../listings/entities/listing.entity';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsService } from './analytics.service';
import { StatsPublicController } from './stats-public.controller';

@Module({
  // AuthModule provides AuthTokenService for the controller-level JwtAuthGuard.
  imports: [TypeOrmModule.forFeature([Listing, Lead]), AuthModule],
  controllers: [AnalyticsAdminController, StatsPublicController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
