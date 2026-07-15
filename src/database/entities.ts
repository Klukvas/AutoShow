import { AdminUser } from '../modules/admin-users/entities/admin-user.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { SiteSettings } from '../modules/branding/entities/site-settings.entity';
import { BodyType } from '../modules/catalog/entities/body-type.entity';
import { Color } from '../modules/catalog/entities/color.entity';
import { DriveType } from '../modules/catalog/entities/drive-type.entity';
import { FuelType } from '../modules/catalog/entities/fuel-type.entity';
import { Make } from '../modules/catalog/entities/make.entity';
import { Model } from '../modules/catalog/entities/model.entity';
import { Transmission } from '../modules/catalog/entities/transmission.entity';
import { VehicleOption } from '../modules/catalog/entities/vehicle-option.entity';
import { Lead } from '../modules/leads/entities/lead.entity';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { ListingOption } from '../modules/listings/entities/listing-option.entity';
import { Listing } from '../modules/listings/entities/listing.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';
import { Review } from '../modules/reviews/entities/review.entity';

export const ALL_ENTITIES = [
  SiteSettings,
  AdminUser,
  Make,
  Model,
  BodyType,
  FuelType,
  Transmission,
  DriveType,
  Color,
  VehicleOption,
  Listing,
  ListingMedia,
  MediaRendition,
  ListingOption,
  Lead,
  Reservation,
  Review,
  AuditLog,
];
