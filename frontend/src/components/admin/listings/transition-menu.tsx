'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type FeeType, type ListingStatus } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { formatMoney } from '@/lib/format';
import { Dialog } from '@/components/admin/ui/dialog';
import { TextField } from '@/components/admin/ui/field';
import { RowMenu } from '@/components/admin/ui/row-menu';

type Action = 'publish' | 'archive' | 'mark-sold' | 'reserve' | 'unreserve';

/** Legal transitions per current status — mirrors the backend state machine. */
export const ALLOWED_TRANSITIONS: Record<ListingStatus, Action[]> = {
  draft: ['publish', 'archive'],
  published: ['reserve', 'mark-sold', 'archive'],
  reserved: ['unreserve', 'mark-sold', 'publish', 'archive'],
  archived: ['publish'],
  sold: [],
};

const ACTION_KEY: Record<Action, string> = {
  publish: 'tPublish',
  archive: 'tArchive',
  'mark-sold': 'tMarkSold',
  reserve: 'tReserve',
  unreserve: 'tUnreserve',
};

interface TransitionMenuProps {
  listingId: string;
  version: number;
  status: ListingStatus;
  title: string;
  /** 409 → the parent shows the conflict banner (handoff 1d). */
  onConflict: () => void;
  onError: (message: string) => void;
  /** Hide actions already offered as header primaries (e.g. publish). */
  exclude?: Action[];
  /** Deal economics for the mark-sold dialog (commission preview). */
  priceAmount?: string;
  priceCurrency?: string;
  feeType?: FeeType;
  feePercent?: string | null;
  feeFixedAmount?: string | null;
}

function commissionPreview(
  feeType: FeeType | undefined,
  salePrice: number,
  feePercent: string | null | undefined,
  feeFixedAmount: string | null | undefined,
): number {
  if (feeType === 'fixed') return Number(feeFixedAmount ?? 0);
  if (feeType === 'percent') return (salePrice * Number(feePercent ?? 0)) / 100;
  return 0;
}

/**
 * «Статус ▾» dropdown for the edit header. Every transition asks for
 * confirmation before hitting the backend with the optimistic-lock version.
 * mark-sold additionally asks for the final sale price and previews the
 * commission the platform earns on the deal.
 */
export function TransitionMenu({
  listingId,
  version,
  status,
  title,
  onConflict,
  onError,
  exclude = [],
  priceAmount,
  priceCurrency,
  feeType,
  feePercent,
  feeFixedAmount,
}: TransitionMenuProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [salePrice, setSalePrice] = useState('');

  const actions = ALLOWED_TRANSITIONS[status].filter((a) => !exclude.includes(a));
  if (actions.length === 0) return null;

  const isSale = confirming === 'mark-sold';
  const salePriceNumber = Number(salePrice);
  const salePriceValid = Number.isFinite(salePriceNumber) && salePriceNumber > 0;
  const commission = salePriceValid
    ? commissionPreview(feeType, salePriceNumber, feePercent, feeFixedAmount)
    : 0;

  const open = (action: Action) => {
    if (action === 'mark-sold') setSalePrice(priceAmount ? String(Number(priceAmount)) : '');
    setConfirming(action);
  };

  const run = async (action: Action) => {
    if (busy) return;
    if (action === 'mark-sold' && !salePriceValid) return;
    setBusy(true);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        onError(t('common.sessionExpired'));
        return;
      }
      await adminApi.transitionListing(
        listingId,
        action,
        version,
        { accessToken },
        action === 'mark-sold' ? { salePriceAmount: salePriceNumber } : undefined,
      );
      setConfirming(null);
      router.refresh();
    } catch (err) {
      setConfirming(null);
      if (err instanceof ApiClientError && err.status === 409) onConflict();
      else if (err instanceof ApiClientError && err.status === 429) onError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) onError(err.message);
      else onError(t('common.errorTitle'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RowMenu
        items={actions.map((a) => ({
          label: t(`form.${ACTION_KEY[a]}`),
          onSelect: () => open(a),
        }))}
      />
      <Dialog
        open={confirming !== null}
        onClose={() => (busy ? null : setConfirming(null))}
        title={isSale ? t('form.saleTitle') : t('form.transitionTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={busy}
              className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => confirming && run(confirming)}
              disabled={busy || (isSale && !salePriceValid)}
              className="focus-ring h-10 rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? t('common.saving') : t('common.confirm')}
            </button>
          </>
        }
      >
        {isSale ? (
          <div className="flex flex-col gap-3.5">
            <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
              {t('form.saleBody', { title })}
            </p>
            <TextField
              label={t('form.salePrice', { currency: priceCurrency ?? 'USD' })}
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
            {feeType && feeType !== 'none' && (
              <p className="text-[13px] font-semibold text-ink">
                {t('form.saleCommission')}{' '}
                <span className="tabular">
                  {formatMoney(commission.toFixed(2), (priceCurrency ?? 'USD') as never)}
                </span>{' '}
                <span className="font-normal text-ink-3">
                  {feeType === 'percent'
                    ? t('form.saleCommissionPercent', { percent: Number(feePercent ?? 0) })
                    : t('form.saleCommissionFixed')}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
            {confirming &&
              t('form.transitionBody', { title, action: t(`form.${ACTION_KEY[confirming]}`) })}
          </p>
        )}
      </Dialog>
    </>
  );
}

export type { Action as TransitionAction };
