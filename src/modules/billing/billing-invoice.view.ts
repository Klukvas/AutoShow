import type { BillingInvoice } from './entities/billing-invoice.entity';
import { INVOICE_VALIDITY_SECONDS } from './monobank.client';

/**
 * `mismatch`: Monobank reports the invoice paid, but amount/currency differ
 * from what we billed, so nothing was credited — needs a manual check.
 */
export type InvoiceViewStatus = BillingInvoice['status'] | 'mismatch';

export interface BillingInvoiceView {
  invoiceId: string;
  amountUah: number;
  status: InvoiceViewStatus;
  /** Hosting invoices only. */
  periodMonths: number | null;
  /** Photo packs only. */
  photos: number | null;
  createdAt: string;
  creditedAt: string | null;
  /** Only while the invoice can still be paid. */
  pageUrl: string | null;
}

const PAYABLE_STATUSES: ReadonlyArray<BillingInvoice['status']> = ['created', 'processing'];

/**
 * Monobank sends no webhook when an invoice expires, so an unpaid invoice
 * past its validity is shown as expired and its payment link is dropped.
 * A `success` that was never credited (amount/currency mismatch) is shown as
 * `mismatch`, never as paid.
 */
export function toInvoiceView(row: BillingInvoice, now: Date): BillingInvoiceView {
  const isPayable = PAYABLE_STATUSES.includes(row.status);
  const isPastValidity = now.getTime() - row.createdAt.getTime() >= INVOICE_VALIDITY_SECONDS * 1000;
  const isExpired = isPayable && isPastValidity;
  return {
    invoiceId: row.invoiceId,
    amountUah: row.amountKop / 100,
    status: viewStatus(row, isExpired),
    periodMonths: row.periodMonths,
    photos: row.photos,
    createdAt: row.createdAt.toISOString(),
    creditedAt: row.creditedAt ? row.creditedAt.toISOString() : null,
    pageUrl: isPayable && !isExpired ? row.pageUrl : null,
  };
}

function viewStatus(row: BillingInvoice, isExpired: boolean): InvoiceViewStatus {
  if (isExpired) return 'expired';
  if (row.status === 'success' && !row.creditedAt) return 'mismatch';
  return row.status;
}
