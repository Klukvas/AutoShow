import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogService } from './catalog.service';
import { CatalogPublicController } from './catalog-public.controller';
import { BodyType } from './entities/body-type.entity';
import { Color } from './entities/color.entity';
import { DriveType } from './entities/drive-type.entity';
import { FuelType } from './entities/fuel-type.entity';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { Transmission } from './entities/transmission.entity';
import { VehicleOption } from './entities/vehicle-option.entity';
import { Listing } from '../listings/entities/listing.entity';

const ENTITIES = [Make, Model, BodyType, FuelType, Transmission, DriveType, Color, VehicleOption];

@Module({
  imports: [TypeOrmModule.forFeature([...ENTITIES, Listing]), AuditModule, AuthModule],
  controllers: [CatalogPublicController, CatalogAdminController],
  providers: [CatalogService, CatalogAdminService],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
