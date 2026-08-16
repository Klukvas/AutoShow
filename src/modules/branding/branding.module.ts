import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Listing } from '../listings/entities/listing.entity';
import { SiteSettings } from './entities/site-settings.entity';
import { BrandingAdminController } from './branding-admin.controller';
import { BrandingPublicController } from './branding-public.controller';
import { BrandingService } from './branding.service';

@Module({
  // Listing repo (not ListingsModule — that would be a cycle): a base-currency
  // change renormalizes every stored priceNormalized. FxRateProvider comes from
  // the global FxModule.
  imports: [TypeOrmModule.forFeature([SiteSettings, Listing]), AuditModule, AuthModule],
  controllers: [BrandingPublicController, BrandingAdminController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
