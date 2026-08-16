import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { Listing } from '../listings/entities/listing.entity';
import { Lead } from './entities/lead.entity';
import { LeadNote } from './entities/lead-note.entity';
import { LeadsAdminController } from './leads-admin.controller';
import { LeadsPublicController } from './leads-public.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, LeadNote, AdminUser, Listing]),
    NotificationModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [LeadsPublicController, LeadsAdminController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
