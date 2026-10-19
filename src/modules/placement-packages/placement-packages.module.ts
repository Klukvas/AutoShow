import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PlacementPackage } from './entities/placement-package.entity';
import { PlacementPackagesAdminController } from './placement-packages-admin.controller';
import { PlacementPackagesPublicController } from './placement-packages-public.controller';
import { PlacementPackagesService } from './placement-packages.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlacementPackage]), AuthModule, AuditModule],
  controllers: [PlacementPackagesPublicController, PlacementPackagesAdminController],
  providers: [PlacementPackagesService],
  // Leads resolve the visitor's chosen package to snapshot its title and price.
  exports: [PlacementPackagesService],
})
export class PlacementPackagesModule {}
