import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { Listing } from '../listings/entities/listing.entity';
import { Lead } from './entities/lead.entity';
import { LeadsAdminController } from './leads-admin.controller';
import { LeadsPublicController } from './leads-public.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Listing]), NotificationModule, AuditModule, AuthModule],
  controllers: [LeadsPublicController, LeadsAdminController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
