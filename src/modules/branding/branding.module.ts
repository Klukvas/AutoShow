import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SiteSettings } from './entities/site-settings.entity';
import { BrandingAdminController } from './branding-admin.controller';
import { BrandingPublicController } from './branding-public.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteSettings]), AuditModule, AuthModule],
  controllers: [BrandingPublicController, BrandingAdminController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
