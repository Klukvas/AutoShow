import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import type { Currency } from '../../../common/types/currency';

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

/**
 * FUTURE: not used in v1. Schema is materialized so future migrations don't
 * have to introduce a breaking change. Reservation lifecycle is
 * intentionally DECOUPLED from Listing.status='reserved' for v1.
 */
@Entity('reservations')
@Index('ix_reservations_listing', ['listingId'])
@Index('ix_reservations_status', ['status'])
export class Reservation extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @Column({ name: 'customer_name', type: 'varchar', length: 128 })
  customerName!: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 32 })
  customerPhone!: string;

  @Column({ name: 'deposit_amount', type: 'numeric', precision: 12, scale: 2 })
  depositAmount!: string;

  @Column({ name: 'deposit_currency', type: 'varchar', length: 3 })
  depositCurrency!: Currency;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  status!: ReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
