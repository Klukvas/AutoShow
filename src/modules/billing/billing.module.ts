import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BillingAdminController } from './billing-admin.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { BILLING_SETTINGS, buildBillingSettings } from './billing.config';
import { BillingService } from './billing.service';
import { BillingAccount } from './entities/billing-account.entity';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { MonobankClient } from './monobank.client';
import { PhotoPackController } from './photo-pack.controller';
import { PhotoPackService } from './photo-pack.service';

@Module({
  imports: [TypeOrmModule.forFeature([BillingAccount, BillingInvoice]), AuditModule, AuthModule],
  controllers: [BillingAdminController, BillingWebhookController, PhotoPackController],
  providers: [
    {
      provide: BILLING_SETTINGS,
      inject: ['APP_CONFIG'],
      useFactory: (config: AppConfig) => buildBillingSettings(config),
    },
    MonobankClient,
    BillingService,
    PhotoPackService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
