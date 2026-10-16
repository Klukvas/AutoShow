'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Banner } from '@/components/admin/ui/banner';
import { formatBillingDate, formatUah, latestPendingInvoice } from '@/lib/admin/billing';
import {
  isSafePaymentUrl,
  photoBalanceNotice,
  photoPacksApi,
  PHOTO_PACK_RETURN_PARAM,
  type PhotoPackOverview,
} from '@/lib/admin/photo-packs';

const queryKey = ['photo-ai-credits'];
const button =
  'focus-ring min-h-11 border px-4 py-2 text-sm font-medium disabled:opacity-50 border-accent bg-accent text-on-accent';

/**
 * Managed photo-AI balance (admin-only, on the branding page): photos left,
 * «Купити пакет», low/empty banners and pack purchase history. After the
 * Monobank redirect (`?photoPackReturned=1`) the newest pending pack is
 * re-checked so the photos arrive even if the webhook is late.
 */
export function PhotoPackPanel() {
  const t = useTranslations('admin.photoAiSettings.managed');
  const query = useQuery({
    queryKey,
    queryFn: photoPacksApi.overview,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useReturnSync(query.data, setNotice, setError);

  const overview = query.data;
  if (query.isPending) return <p className="text-sm text-ink-3">{t('loading')}</p>;
  if (query.error || !overview) return <Banner tone="error">{t('loadError')}</Banner>;
  if (overview.mode !== 'managed') return null;

  async function buy() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { pageUrl } = await photoPacksApi.buy();
      if (!isSafePaymentUrl(pageUrl)) throw new Error(t('buyError'));
      window.location.assign(pageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('buyError'));
      setBusy(false);
    }
  }

  const balanceNotice = photoBalanceNotice(overview);
  const available = Math.max(0, overview.balance.available);
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">{t('balanceTitle')}</h3>
      {balanceNotice && (
        <Banner tone={balanceNotice.tone}>
          {balanceNotice.kind === 'empty' ? t('empty') : t('low', { count: available })}
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      {notice && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.05em] text-ink-3">{t('available')}</dt>
          <dd className="mt-1 text-lg font-medium text-ink">{available}</dd>
        </div>
        {overview.balance.reserved > 0 && (
          <div>
            <dt className="text-xs uppercase tracking-[0.05em] text-ink-3">{t('reserved')}</dt>
            <dd className="mt-1 text-lg font-medium text-ink">{overview.balance.reserved}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs leading-relaxed text-ink-3">{t('terms')}</p>
      <button type="button" className={button} disabled={busy} onClick={() => void buy()}>
        {busy
          ? t('buying')
          : t('buy', { photos: overview.packSize, price: formatUah(overview.packPriceUah) })}
      </button>
      <PackHistory overview={overview} />
    </div>
  );
}

function PackHistory({ overview }: { overview: Extract<PhotoPackOverview, { mode: 'managed' }> }) {
  const t = useTranslations('admin.photoAiSettings.managed');
  const tStatus = useTranslations('admin.billing.invoiceStatus');
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-[0.05em] text-ink-3">{t('history')}</h4>
      {overview.invoices.length === 0 ? (
        <p className="text-sm text-ink-3">{t('historyEmpty')}</p>
      ) : (
        <ul className="divide-y divide-line/70 text-sm">
          {overview.invoices.map((invoice) => (
            <li key={invoice.invoiceId} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
              <span className="w-[150px] text-ink-2">{formatBillingDate(invoice.createdAt)}</span>
              <span className="w-[80px] text-ink">{formatUah(invoice.amountUah)}</span>
              <span className="w-[80px] text-ink-3">
                {t('photosValue', { photos: invoice.photos ?? 0 })}
              </span>
              <span className="flex-1 text-ink-2">{tStatus(invoice.status)}</span>
              {invoice.pageUrl && isSafePaymentUrl(invoice.pageUrl) && (
                <a href={invoice.pageUrl} className="text-accent underline">
                  {t('continuePayment')}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** After the Monobank redirect: re-check the newest pending pack once, then refresh. */
function useReturnSync(
  overview: PhotoPackOverview | undefined,
  setNotice: (text: string) => void,
  setError: (text: string) => void,
) {
  const t = useTranslations('admin.photoAiSettings.managed');
  const router = useRouter();
  const client = useQueryClient();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !overview) return;
    handled.current = true;
    if (!new URLSearchParams(window.location.search).has(PHOTO_PACK_RETURN_PARAM)) return;
    router.replace('/admin/branding');
    const pending = overview.mode === 'managed' ? latestPendingInvoice(overview.invoices) : null;
    if (!pending) return;
    photoPacksApi
      .sync(pending.invoiceId)
      .then(() => {
        setNotice(t('checked'));
        return client.invalidateQueries({ queryKey });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('buyError')));
  }, [overview, router, client, setNotice, setError, t]);
}
