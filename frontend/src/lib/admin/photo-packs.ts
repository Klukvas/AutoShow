import { apiFetch } from '../api/client';
import { fetchAccessToken } from '../auth/use-access-token';
import type { BillingInvoice } from './billing';

/** Managed photo-AI packs — mirrors backend src/modules/billing/photo-pack.service.ts. */
export interface PhotoBalance {
  credited: number;
  reserved: number;
  consumed: number;
  /** May be negative after a refunded pack. */
  available: number;
}

export type PhotoPackOverview =
  | { mode: 'own_key' }
  | {
      mode: 'managed';
      packSize: number;
      packPriceUah: number;
      balance: PhotoBalance;
      isLow: boolean;
      isEmpty: boolean;
      invoices: BillingInvoice[];
    };

/** URL marker Monobank sends the payer back with (see backend redirectUrl). */
export const PHOTO_PACK_RETURN_PARAM = 'photoPackReturned';

async function call<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const accessToken = await fetchAccessToken();
  if (!accessToken) throw new Error('Сесія закінчилася. Увійдіть знову.');
  return apiFetch<T>(path, { accessToken, cache: 'no-store', method });
}

export const photoPacksApi = {
  overview: () => call<PhotoPackOverview>('/admin/photo-ai/credits'),
  buy: () => call<{ invoiceId: string; pageUrl: string }>('/admin/photo-ai/credits/packs', 'POST'),
  sync: (invoiceId: string) =>
    call<BillingInvoice>(
      `/admin/photo-ai/credits/packs/${encodeURIComponent(invoiceId)}/sync`,
      'POST',
    ),
};

export type PhotoBalanceNotice =
  | { tone: 'warning'; kind: 'low' }
  | { tone: 'error'; kind: 'empty' };

export function photoBalanceNotice(
  overview: PhotoPackOverview | undefined,
): PhotoBalanceNotice | null {
  if (!overview || overview.mode !== 'managed') return null;
  if (overview.isEmpty) return { tone: 'error', kind: 'empty' };
  if (overview.isLow) return { tone: 'warning', kind: 'low' };
  return null;
}

/** Monobank payment pages are https only — never navigate anywhere else. */
export function isSafePaymentUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
