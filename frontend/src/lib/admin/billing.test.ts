import { describe, expect, it } from 'vitest';
import {
  billingNotice,
  formatBillingDate,
  latestPendingInvoice,
  type BillingDetails,
  type BillingInvoice,
} from './billing';

const details = (state: BillingDetails['state']): BillingDetails => ({
  enabled: true,
  blocked: state === 'blocked',
  state,
  paidUntil: '2026-11-01T00:00:00.000Z',
  blockAt: '2026-11-11T00:00:00.000Z',
  daysLeft: 3,
  daysUntilBlock: 13,
  monthlyPriceUah: 500,
  periodMonths: 1,
  amountUah: 500,
  remindDays: 7,
  graceDays: 10,
});

const invoice = (id: string, status: BillingInvoice['status'], createdAt: string) => ({
  invoiceId: id,
  amountUah: 500,
  status,
  periodMonths: 1,
  photos: null,
  createdAt,
  creditedAt: null,
  pageUrl: null,
});

describe('billingNotice', () => {
  it('warns when payment is due soon and errors when overdue', () => {
    expect(billingNotice(details('due_soon'))).toEqual({ tone: 'warning', kind: 'dueSoon' });
    expect(billingNotice(details('overdue'))).toEqual({ tone: 'error', kind: 'overdue' });
  });

  it('shows nothing while active, once blocked (full-page lock instead) or when disabled', () => {
    expect(billingNotice(details('active'))).toBeNull();
    expect(billingNotice(details('blocked'))).toBeNull();
    expect(billingNotice({ enabled: false, blocked: false })).toBeNull();
    expect(billingNotice(null)).toBeNull();
  });

  it('never shows a reminder to an editor (flags only, no details)', () => {
    expect(billingNotice({ enabled: true, blocked: false })).toBeNull();
  });
});

describe('latestPendingInvoice', () => {
  it('picks the newest invoice that can still be paid', () => {
    const picked = latestPendingInvoice([
      invoice('old', 'created', '2026-10-01T00:00:00Z'),
      invoice('paid', 'success', '2026-10-15T00:00:00Z'),
      invoice('new', 'processing', '2026-10-10T00:00:00Z'),
    ]);
    expect(picked?.invoiceId).toBe('new');
  });

  it('skips invoices that expired unpaid', () => {
    const picked = latestPendingInvoice([
      invoice('stale', 'expired', '2026-10-15T00:00:00Z'),
      invoice('open', 'created', '2026-10-01T00:00:00Z'),
    ]);
    expect(picked?.invoiceId).toBe('open');
  });

  it('does not treat a paid-but-mismatched invoice as pending', () => {
    expect(latestPendingInvoice([invoice('odd', 'mismatch', '2026-10-15T00:00:00Z')])).toBeNull();
  });

  it('returns null when nothing is pending', () => {
    expect(latestPendingInvoice([invoice('a', 'expired', '2026-10-01T00:00:00Z')])).toBeNull();
  });
});

describe('formatBillingDate', () => {
  it('formats in Kyiv time, not UTC (late 31 Oct UTC is 1 Nov in Kyiv)', () => {
    expect(formatBillingDate('2026-10-31T23:30:00.000Z')).toContain('1 листопада 2026');
  });
});
