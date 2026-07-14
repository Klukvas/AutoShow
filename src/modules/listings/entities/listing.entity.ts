import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { BodyType } from '../../catalog/entities/body-type.entity';
import { Color } from '../../catalog/entities/color.entity';
import { DriveType } from '../../catalog/entities/drive-type.entity';
import { FuelType } from '../../catalog/entities/fuel-type.entity';
import { Make } from '../../catalog/entities/make.entity';
import { Model } from '../../catalog/entities/model.entity';
import { Transmission } from '../../catalog/entities/transmission.entity';
import type { Currency } from '../../../common/types/currency';
import { Lead } from '../../leads/entities/lead.entity';
import { ListingMedia } from './listing-media.entity';
import { ListingOption } from './listing-option.entity';

export type ListingStatus = 'draft' | 'published' | 'reserved' | 'sold' | 'archived';
export type ListingCondition = 'new' | 'used' | 'damaged';
export type ListingSourceType = 'manual' | 'feed' | 'parser';
/** Own stock vs a client's car listed on consignment. */
export type ListingSellerType = 'own' | 'client';
/** How the platform earns on this listing (consignment economics). */
export type ListingFeeType = 'none' | 'fixed' | 'percent';

@Entity('listings')
@Index('uq_listings_slug_alive', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('ix_listings_status_published', ['status', 'publishedAt'])
@Index('ix_listings_make_model', ['makeId', 'modelId'])
@Index('ix_listings_price', ['priceNormalized'], {
  where: `"status" = 'published' AND "deleted_at" IS NULL`,
})
@Index('ix_listings_published_id', ['publishedAt', 'id'], {
  where: `"status" = 'published' AND "deleted_at" IS NULL`,
})
@Index('ix_listings_created_id', ['createdAt', 'id'], {
  where: '"deleted_at" IS NULL',
})
@Index('ix_listings_external', ['sourceType', 'externalId'], {
  where: '"external_id" IS NOT NULL',
})
export class Listing extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  slug!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'draft',
  })
  status!: ListingStatus;

  @Column({ name: 'make_id', type: 'uuid' })
  makeId!: string;

  @ManyToOne(() => Make)
  @JoinColumn({ name: 'make_id' })
  make?: Make;

  @Column({ name: 'model_id', type: 'uuid' })
  modelId!: string;

  @ManyToOne(() => Model)
  @JoinColumn({ name: 'model_id' })
  model?: Model;

  @Column({ type: 'varchar', length: 64, nullable: true })
  generation!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  modification!: string | null;

  @Column({ type: 'int' })
  year!: number;

  @Column({ name: 'mileage_km', type: 'int' })
  mileageKm!: number;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin!: string | null;

  @Column({ name: 'vin_visible', type: 'boolean', default: false })
  vinVisible!: boolean;

  @Column({ name: 'body_type_id', type: 'uuid' })
  bodyTypeId!: string;

  @ManyToOne(() => BodyType)
  @JoinColumn({ name: 'body_type_id' })
  bodyType?: BodyType;

  @Column({ name: 'fuel_type_id', type: 'uuid' })
  fuelTypeId!: string;

  @ManyToOne(() => FuelType)
  @JoinColumn({ name: 'fuel_type_id' })
  fuelType?: FuelType;

  @Column({ name: 'transmission_id', type: 'uuid' })
  transmissionId!: string;

  @ManyToOne(() => Transmission)
  @JoinColumn({ name: 'transmission_id' })
  transmission?: Transmission;

  @Column({ name: 'drive_type_id', type: 'uuid' })
  driveTypeId!: string;

  @ManyToOne(() => DriveType)
  @JoinColumn({ name: 'drive_type_id' })
  driveType?: DriveType;

  @Column({ name: 'color_id', type: 'uuid' })
  colorId!: string;

  @ManyToOne(() => Color)
  @JoinColumn({ name: 'color_id' })
  color?: Color;

  @Column({ name: 'engine_volume_l', type: 'numeric', precision: 3, scale: 1 })
  engineVolumeL!: string;

  @Column({ name: 'power_hp', type: 'int' })
  powerHp!: number;

  @Column({
    type: 'varchar',
    length: 16,
  })
  condition!: ListingCondition;

  @Column({ name: 'owners_count', type: 'int', default: 1 })
  ownersCount!: number;

  @Column({ name: 'is_crashed', type: 'boolean', default: false })
  isCrashed!: boolean;

  @Column({ name: 'customs_cleared', type: 'boolean', default: true })
  customsCleared!: boolean;

  /* ---------------- pricing ---------------- */

  @Column({ name: 'price_amount', type: 'numeric', precision: 12, scale: 2 })
  priceAmount!: string;

  @Column({ name: 'price_currency', type: 'varchar', length: 3 })
  priceCurrency!: Currency;

  @Column({ name: 'price_normalized', type: 'numeric', precision: 14, scale: 2 })
  priceNormalized!: string;

  @Column({ name: 'fx_rate', type: 'numeric', precision: 12, scale: 6, nullable: true })
  fxRate!: string | null;

  @Column({ name: 'fx_rate_at', type: 'timestamptz', nullable: true })
  fxRateAt!: Date | null;

  @Column({ name: 'is_negotiable', type: 'boolean', default: false })
  isNegotiable!: boolean;

  /* ---------------- consignment economics ----------------
   * Clients bring cars to the showroom; the platform earns either a fixed
   * listing fee or a percentage of the final sale price. All of this is
   * back-office data — the public mapper must never expose it. */

  @Column({ name: 'seller_type', type: 'varchar', length: 16, default: 'own' })
  sellerType!: ListingSellerType;

  @Column({ name: 'seller_name', type: 'varchar', length: 128, nullable: true })
  sellerName!: string | null;

  @Column({ name: 'seller_phone', type: 'varchar', length: 32, nullable: true })
  sellerPhone!: string | null;

  @Column({ name: 'fee_type', type: 'varchar', length: 16, default: 'none' })
  feeType!: ListingFeeType;

  @Column({ name: 'fee_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  feePercent!: string | null;

  @Column({ name: 'fee_fixed_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  feeFixedAmount!: string | null;

  /* Stamped by the mark-sold transition (in the listing's price currency). */

  @Column({ name: 'sale_price_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  salePriceAmount!: string | null;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  commissionAmount!: string | null;

  /* ---------------- content ---------------- */

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'location_city', type: 'varchar', length: 128 })
  locationCity!: string;

  @Column({ name: 'location_region', type: 'varchar', length: 128, nullable: true })
  locationRegion!: string | null;

  @Column({ name: 'meta_title', type: 'varchar', length: 255, nullable: true })
  metaTitle!: string | null;

  @Column({ name: 'meta_description', type: 'varchar', length: 320, nullable: true })
  metaDescription!: string | null;

  /* ---------------- source (FUTURE feeds) ---------------- */

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 16,
    default: 'manual',
  })
  sourceType!: ListingSourceType;

  @Column({ name: 'external_id', type: 'varchar', length: 128, nullable: true })
  externalId!: string | null;

  /* ---------------- metrics ---------------- */

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount!: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'sold_at', type: 'timestamptz', nullable: true })
  soldAt!: Date | null;

  /* ---------------- relations ---------------- */

  @OneToMany(() => ListingMedia, (m) => m.listing)
  media?: ListingMedia[];

  @OneToMany(() => Lead, (l) => l.listing)
  leads?: Lead[];

  // cascade excludes 'soft-remove'/'recover': ListingOption has no delete-date
  // column, so a cascaded soft-remove would throw MissingDeleteDateColumnError.
  // The join rows are already invisible once the listing is soft-deleted, and
  // listing_id is ON DELETE CASCADE for hard deletes.
  @OneToMany(() => ListingOption, (lo) => lo.listing, { cascade: ['insert', 'update'] })
  options?: ListingOption[];
}
