import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { MonobankInvoiceStatus } from '../monobank.types';

/** One Monobank acquiring invoice created from the admin billing page. */
@Entity('billing_invoices')
export class BillingInvoice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'invoice_id', type: 'varchar', length: 64 }) invoiceId!: string;
  /** Expected amount in kopecks — a payment for anything else is never credited. */
  @Column({ name: 'amount_kop', type: 'integer' }) amountKop!: number;
  @Column({ type: 'smallint' }) ccy!: number;
  @Column({ type: 'varchar', length: 16 }) status!: MonobankInvoiceStatus;
  @Column({ name: 'period_months', type: 'smallint' }) periodMonths!: number;
  @Column({ name: 'page_url', type: 'text' }) pageUrl!: string;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  /** Monobank's modifiedDate of the last applied status — guards against stale updates. */
  @Column({ name: 'modified_at', type: 'timestamptz', nullable: true }) modifiedAt!: Date | null;
  @Column({ name: 'credited_at', type: 'timestamptz', nullable: true }) creditedAt!: Date | null;
}
