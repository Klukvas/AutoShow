import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Currency } from '../../../common/types/currency';

/**
 * Append-only record of a price a listing has had. Written on create (baseline)
 * and on every price/currency edit. Immutable — no update/delete surface.
 */
@Entity('listing_price_history')
@Index('ix_listing_price_history_listing', ['listingId', 'createdAt'])
export class ListingPriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'price_amount', type: 'numeric', precision: 12, scale: 2 })
  priceAmount!: string;

  @Column({ name: 'price_currency', type: 'varchar', length: 3 })
  priceCurrency!: Currency;

  @Column({ name: 'price_normalized', type: 'numeric', precision: 14, scale: 2 })
  priceNormalized!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
