'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import {
  billingApi,
  formatBillingDate,
  formatUah,
  hasBillingDetails,
  latestPendingInvoice,
  type BillingInvoice,
  type BillingState,
  type BillingStatus,
} from '@/lib/admin/billing';
import { Banner } from '@/components/admin/ui/banner';
import { SectionCard } from '@/components/admin/ui/section-card';

const RETURN_PARAM = 'returned';

const STATE_TONE: Record<BillingState, string> = {
  active: 'text-st-published-fg',
  due_soon: 'text-ratelimit',
  overdue: 'text-danger',
  blocked: 'text-danger',
};

interface BillingPanelProps {
  status: BillingStatus;
  invoices: BillingInvoice[];
}

const INVOICE_TONE: Partial<Record<BillingInvoice['status'], string>> = {
  success: 'text-st-published-fg',
  mismatch: 'text-danger',
  // Refunded: the paid period was rolled back.
  reversed: 'text-ratelimit',
};

type Feedback = { tone: 'error' | 'info'; text: string } | null;

/**
 * Admin payment page body: paid-until, price, «Оплатити» (Monobank invoice →
 * redirect) and history. After Monobank sends the payer back (`?returned=1`)
 * the newest pending invoice is re-checked, so access returns even if the
 * webhook is late or lost.
 */
export function BillingPanel({ status, invoices }: BillingPanelProps) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  /** 'pay' or the invoice id being re-checked. */
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const returnHandled = useRef(false);

  const withToken = async (key: string, fn: (token: string) => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setFeedback(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setFeedback({ tone: 'error', text: tc('sessionExpired') });
        return;
      }
      await fn(token);
    } catch (e) {
      const text = e instanceof ApiClientError ? e.message : tc('errorTitle');
      setFeedback({ tone: 'error', text });
    } finally {
      setBusy(null);
    }
  };

  const pay = () =>
    withToken('pay', async (token) => {
      const { pageUrl } = await billingApi.createInvoice({ accessToken: token });
      window.location.assign(pageUrl);
    });

  const check = (invoiceId: string) =>
    withToken(invoiceId, async (token) => {
      await billingApi.syncInvoice(invoiceId, { accessToken: token });
      setFeedback({ tone: 'info', text: t('checked') });
      router.refresh();
    });

  useEffect(() => {
    if (returnHandled.current) return;
    returnHandled.current = true;
    if (!new URLSearchParams(window.location.search).has(RETURN_PARAM)) return;
    router.replace('/admin/billing');
    const pending = latestPendingInvoice(invoices);
    if (pending) void check(pending.invoiceId);
    // Runs once per mount: the return marker is consumed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasBillingDetails(status)) {
    return (
      <SectionCard title={t('title')}>
        <p className="text-[0.875rem] font-medium text-ink-2">{t('disabled')}</p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-[1.25rem] font-medium tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-[0.8125rem] font-medium text-ink-3">{t('subtitle')}</p>
      </div>

      {status.blocked && (
        <Banner tone="error">
          <strong className="font-medium">{t('blocked.adminTitle')}.</strong>{' '}
          {t('blocked.adminBody')}
        </Banner>
      )}
      {busy && busy !== 'pay' && <Banner tone="info">{t('checking')}</Banner>}
      {feedback && <Banner tone={feedback.tone}>{feedback.text}</Banner>}

      <SectionCard>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={t('stateLabel')}>
            <span className={cn(STATE_TONE[status.state])}>{t(`state.${status.state}`)}</span>
          </Fact>
          <Fact label={t('paidUntil')}>{formatBillingDate(status.paidUntil)}</Fact>
          <Fact label={t('price')}>
            {t('pricePerMonth', { amount: formatUah(status.monthlyPriceUah) })}
          </Fact>
          <Fact label={t('invoiceAmount')}>
            {t('invoiceAmountValue', {
              amount: formatUah(status.amountUah),
              months: status.periodMonths,
            })}
          </Fact>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={pay}
            disabled={busy !== null}
            className="focus-ring inline-flex h-10 items-center rounded-none bg-accent px-5 text-[0.8125rem] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy === 'pay' ? t('paying') : t('pay')}
          </button>
          <p className="text-[0.75rem] font-medium text-ink-3">{t('payHint')}</p>
        </div>
      </SectionCard>

      <SectionCard title={t('history')}>
        {invoices.length === 0 ? (
          <p className="text-[0.8125rem] font-medium text-ink-3">{t('historyEmpty')}</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.invoiceId}
                invoice={invoice}
                isBusy={busy === invoice.invoiceId}
                isDisabled={busy !== null}
                onCheck={() => check(invoice.invoiceId)}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-ink-3">
        {label}
      </dt>
      <dd className="mt-1 text-[0.9375rem] font-medium text-ink">{children}</dd>
    </div>
  );
}

function InvoiceRow({
  invoice,
  isBusy,
  isDisabled,
  onCheck,
}: {
  invoice: BillingInvoice;
  isBusy: boolean;
  isDisabled: boolean;
  onCheck: () => void;
}) {
  const t = useTranslations('admin.billing');
  const isPending = invoice.status === 'created' || invoice.status === 'processing';
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-[0.8125rem] font-medium">
      <span className="w-[150px] text-ink-2">{formatBillingDate(invoice.createdAt)}</span>
      <span className="w-[90px] text-ink">{formatUah(invoice.amountUah)}</span>
      <span className="w-[90px] text-ink-3">
        {t('periodValue', { months: invoice.periodMonths })}
      </span>
      <span className={cn('flex-1', INVOICE_TONE[invoice.status] ?? 'text-ink-2')}>
        {t(`invoiceStatus.${invoice.status}`)}
      </span>
      {isPending && (
        <span className="flex gap-2">
          {invoice.pageUrl && (
            <a
              href={invoice.pageUrl}
              className="focus-ring inline-flex h-8 items-center rounded-none border border-line-input px-3 text-[0.75rem] text-ink"
            >
              {t('continuePayment')}
            </a>
          )}
          <button
            type="button"
            onClick={onCheck}
            disabled={isDisabled}
            className="focus-ring inline-flex h-8 items-center rounded-none border border-line-input px-3 text-[0.75rem] text-ink disabled:opacity-60"
          >
            {isBusy ? t('checking') : t('check')}
          </button>
        </span>
      )}
    </li>
  );
}
