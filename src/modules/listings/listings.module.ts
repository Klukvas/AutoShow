import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BrandingModule } from '../branding/branding.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BodyType } from '../catalog/entities/body-type.entity';
import { Color } from '../catalog/entities/color.entity';
import { DriveType } from '../catalog/entities/drive-type.entity';
import { FuelType } from '../catalog/entities/fuel-type.entity';
import { Make } from '../catalog/entities/make.entity';
import { Model } from '../catalog/entities/model.entity';
import { Transmission } from '../catalog/entities/transmission.entity';
import { VehicleOption } from '../catalog/entities/vehicle-option.entity';
import { Tag } from '../catalog/entities/tag.entity';
import { ListingsAdminController } from './listings-admin.controller';
import { ListingsPublicController } from './listings-public.controller';
import { ListingsMapper } from './listings.mapper';
import { ListingsService } from './listings.service';
import { Listing } from './entities/listing.entity';
import { ListingMedia } from './entities/listing-media.entity';
import { ListingOption } from './entities/listing-option.entity';
import { ListingTag } from './entities/listing-tag.entity';
import { ListingPriceHistory } from './entities/listing-price-history.entity';
import { MediaRendition } from './entities/media-rendition.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      ListingMedia,
      ListingOption,
      ListingTag,
      ListingPriceHistory,
      MediaRendition,
      Make,
      Model,
      BodyType,
      FuelType,
      Transmission,
      DriveType,
      Color,
      VehicleOption,
      Tag,
    ]),
    AuditModule,
    AuthModule,
    BrandingModule,
    TelegramModule,
  ],
  controllers: [ListingsPublicController, ListingsAdminController],
  providers: [ListingsService, ListingsMapper],
  exports: [ListingsService, ListingsMapper],
})
export class ListingsModule {}
