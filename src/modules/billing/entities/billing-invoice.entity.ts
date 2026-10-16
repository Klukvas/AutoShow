import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { MonobankInvoiceStatus } from '../monobank.types';

export type BillingInvoiceKind = 'hosting' | 'photo_pack';

/** One Monobank acquiring invoice created from the admin billing page. */
@Entity('billing_invoices')
export class BillingInvoice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'invoice_id', type: 'varchar', length: 64 }) invoiceId!: string;
  /** Expected amount in kopecks — a payment for anything else is never credited. */
  @Column({ name: 'amount_kop', type: 'integer' }) amountKop!: number;
  @Column({ type: 'smallint' }) ccy!: number;
  @Column({ type: 'varchar', length: 16 }) status!: MonobankInvoiceStatus;
  /** What the invoice buys: hosting time or a photo-AI pack. */
  @Column({ type: 'varchar', length: 16, default: 'hosting' }) kind!: BillingInvoiceKind;
  /** Hosting only. */
  @Column({ name: 'period_months', type: 'smallint', nullable: true }) periodMonths!: number | null;
  /** Photo packs only: photos credited when paid. */
  @Column({ type: 'integer', nullable: true }) photos!: number | null;
  @Column({ name: 'page_url', type: 'text' }) pageUrl!: string;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  /** Monobank's modifiedDate of the last applied status — guards against stale updates. */
  @Column({ name: 'modified_at', type: 'timestamptz', nullable: true }) modifiedAt!: Date | null;
  @Column({ name: 'credited_at', type: 'timestamptz', nullable: true }) creditedAt!: Date | null;
  /**
   * Start/end of the period this credit granted; start = old paid_until when
   * stacked, the credit instant when restarted. Null for credits made before
   * these columns existed.
   */
  @Column({ name: 'credited_from', type: 'timestamptz', nullable: true })
  creditedFrom!: Date | null;
  @Column({ name: 'credited_until', type: 'timestamptz', nullable: true })
  creditedUntil!: Date | null;
  /** When a full refund rolled paid_until back — set at most once. */
  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true }) reversedAt!: Date | null;
}
