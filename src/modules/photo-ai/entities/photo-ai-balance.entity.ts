import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Singleton (id = 1) running totals of the managed photo balance; always
 * derivable from photo_ai_ledger. available = credited − consumed − reserved
 * (may go negative after a refund → AI unavailable until topped up).
 */
@Entity('photo_ai_balance')
export class PhotoAiBalance {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'integer', default: 0 }) credited!: number;
  @Column({ type: 'integer', default: 0 }) reserved!: number;
  @Column({ type: 'integer', default: 0 }) consumed!: number;
  @Column({ name: 'free_granted_at', type: 'timestamptz', nullable: true })
  freeGrantedAt!: Date | null;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt!: Date;
}
