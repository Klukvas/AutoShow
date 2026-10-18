import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Singleton (id = 1) running totals of the managed description balance;
 * always derivable from listing_ai_ledger. Kept apart from the photo balance
 * because a description costs a fraction of a photo.
 * available = credited − consumed − reserved.
 */
@Entity('listing_ai_balance')
export class ListingAiBalance {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'integer', default: 0 }) credited!: number;
  @Column({ type: 'integer', default: 0 }) reserved!: number;
  @Column({ type: 'integer', default: 0 }) consumed!: number;
  @Column({ name: 'free_granted_at', type: 'timestamptz', nullable: true })
  freeGrantedAt!: Date | null;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}
