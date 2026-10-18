import { AiCredentials } from '../modules/ai-credentials/entities/ai-credentials.entity';
import { ListingAiBalance } from '../modules/listing-ai/entities/listing-ai-balance.entity';
import { ListingAiGeneration } from '../modules/listing-ai/entities/listing-ai-generation.entity';
import { ListingAiLedgerEntry } from '../modules/listing-ai/entities/listing-ai-ledger-entry.entity';
import { ListingAiSettings } from '../modules/listing-ai/entities/listing-ai-settings.entity';
import { PhotoAiSettings } from '../modules/photo-ai/entities/photo-ai-settings.entity';
import { PhotoAiGeneration } from '../modules/photo-ai/entities/photo-ai-generation.entity';
import { PhotoAiPreset } from '../modules/photo-ai/entities/photo-ai-preset.entity';
import { PhotoAiBalance } from '../modules/photo-ai/entities/photo-ai-balance.entity';
import { PhotoAiLedgerEntry } from '../modules/photo-ai/entities/photo-ai-ledger-entry.entity';
import { AdminUser } from '../modules/admin-users/entities/admin-user.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { BillingAccount } from '../modules/billing/entities/billing-account.entity';
import { BillingInvoice } from '../modules/billing/entities/billing-invoice.entity';
import { SiteSettings } from '../modules/branding/entities/site-settings.entity';
import { BodyType } from '../modules/catalog/entities/body-type.entity';
import { Collection } from '../modules/collections/entities/collection.entity';
import { Color } from '../modules/catalog/entities/color.entity';
import { DriveType } from '../modules/catalog/entities/drive-type.entity';
import { FuelType } from '../modules/catalog/entities/fuel-type.entity';
import { Make } from '../modules/catalog/entities/make.entity';
import { Model } from '../modules/catalog/entities/model.entity';
import { Tag } from '../modules/catalog/entities/tag.entity';
import { Transmission } from '../modules/catalog/entities/transmission.entity';
import { VehicleOption } from '../modules/catalog/entities/vehicle-option.entity';
import { Lead } from '../modules/leads/entities/lead.entity';
import { LeadNote } from '../modules/leads/entities/lead-note.entity';
import { ListingMedia } from '../modules/listings/entities/listing-media.entity';
import { ListingOption } from '../modules/listings/entities/listing-option.entity';
import { ListingTag } from '../modules/listings/entities/listing-tag.entity';
import { ListingPriceHistory } from '../modules/listings/entities/listing-price-history.entity';
import { Listing } from '../modules/listings/entities/listing.entity';
import { MediaRendition } from '../modules/listings/entities/media-rendition.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { ListingTelegramPost } from '../modules/telegram/entities/listing-telegram-post.entity';

export const ALL_ENTITIES = [
  AiCredentials,
  ListingAiGeneration,
  ListingAiSettings,
  ListingAiBalance,
  ListingAiLedgerEntry,
  PhotoAiSettings,
  PhotoAiGeneration,
  PhotoAiPreset,
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
  Tag,
  Listing,
  ListingMedia,
  MediaRendition,
  ListingOption,
  ListingTag,
  ListingPriceHistory,
  ListingTelegramPost,
  Lead,
  LeadNote,
  Reservation,
  Review,
  AuditLog,
  Collection,
  BillingAccount,
  BillingInvoice,
  PhotoAiBalance,
  PhotoAiLedgerEntry,
];
