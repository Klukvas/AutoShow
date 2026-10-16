import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Singleton (id = 1): until when the hosting subscription is paid. */
@Entity('billing_account')
export class BillingAccount {
  @PrimaryColumn({ type: 'smallint' }) id!: number;
  @Column({ name: 'paid_until', type: 'timestamptz' }) paidUntil!: Date;
  @Column({ type: 'integer', default: 0 }) revision!: number;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
