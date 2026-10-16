import { apiFetch } from '../api/client';

/** Hosting subscription (Monobank) — mirrors backend src/modules/billing. */
export type BillingState = 'active' | 'due_soon' | 'overdue' | 'blocked';

export type InvoiceStatus =
  | 'created'
  | 'processing'
  | 'hold'
  | 'success'
  | 'failure'
  | 'reversed'
  | 'expired'
  /** Paid at Monobank, but amount/currency did not match — not credited, needs a manual check. */
  | 'mismatch';

/** What every role gets (editors get only this). */
export interface BillingFlags {
  enabled: boolean;
  blocked: boolean;
}

/** Admin-only full status. */
export interface BillingDetails extends BillingFlags {
  enabled: true;
  state: BillingState;
  paidUntil: string;
  blockAt: string;
  daysLeft: number;
  daysUntilBlock: number;
  monthlyPriceUah: number;
  periodMonths: number;
  amountUah: number;
  remindDays: number;
  graceDays: number;
}

export type BillingStatus = BillingFlags | BillingDetails;

export interface BillingInvoice {
  invoiceId: string;
  amountUah: number;
  status: InvoiceStatus;
  /** Hosting invoices only. */
  periodMonths: number | null;
  /** Photo-AI packs only. */
  photos: number | null;
  createdAt: string;
  creditedAt: string | null;
  pageUrl: string | null;
}

interface CallOpts {
  accessToken: string;
}

export const billingApi = {
  status(opts: CallOpts) {
    return apiFetch<BillingStatus>('/admin/billing/status', {
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  invoices(opts: CallOpts) {
    return apiFetch<BillingInvoice[]>('/admin/billing/invoices', {
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  createInvoice(opts: CallOpts) {
    return apiFetch<{ invoiceId: string; pageUrl: string }>('/admin/billing/invoices', {
      method: 'POST',
      accessToken: opts.accessToken,
    });
  },
  syncInvoice(invoiceId: string, opts: CallOpts) {
    return apiFetch<BillingInvoice>(
      `/admin/billing/invoices/${encodeURIComponent(invoiceId)}/sync`,
      { method: 'POST', accessToken: opts.accessToken },
    );
  },
};

export function hasBillingDetails(status: BillingStatus | null): status is BillingDetails {
  return status !== null && status.enabled && 'state' in status;
}

export type BillingNotice =
  | { tone: 'warning'; kind: 'dueSoon' }
  | { tone: 'error'; kind: 'overdue' };

/** Reminder banner for the admin; editors never get details, so never a notice. */
export function billingNotice(status: BillingStatus | null): BillingNotice | null {
  if (!hasBillingDetails(status)) return null;
  if (status.state === 'due_soon') return { tone: 'warning', kind: 'dueSoon' };
  if (status.state === 'overdue') return { tone: 'error', kind: 'overdue' };
  return null;
}

const PENDING: ReadonlyArray<InvoiceStatus> = ['created', 'processing', 'hold'];

/**
 * Newest invoice that may still turn into a payment — re-checked after the
 * Monobank redirect. Invoices past their validity arrive as `expired` from the
 * API (Monobank sends no webhook for that) and are skipped.
 */
export function latestPendingInvoice(invoices: BillingInvoice[]): BillingInvoice | null {
  return (
    [...invoices]
      .filter((invoice) => PENDING.includes(invoice.status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
  );
}

/** Dates are shown in Kyiv time regardless of the server's zone. */
export function formatBillingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });
}

export function formatUah(amount: number): string {
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(amount)} ₴`;
}
