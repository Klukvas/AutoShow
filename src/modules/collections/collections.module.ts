import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CollectionsAdminController } from './collections-admin.controller';
import { CollectionsPublicController } from './collections-public.controller';
import { CollectionsService } from './collections.service';
import { Collection } from './entities/collection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection]), AuditModule, AuthModule],
  controllers: [CollectionsPublicController, CollectionsAdminController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
