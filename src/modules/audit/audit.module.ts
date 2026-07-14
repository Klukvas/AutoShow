import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditAdminController } from './audit-admin.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), AuthModule],
  controllers: [AuditAdminController],
  providers: [AuditLogService],
  exports: [AuditLogService, TypeOrmModule],
})
export class AuditModule {}
