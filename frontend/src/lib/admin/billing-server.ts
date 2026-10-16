import { cache } from 'react';
import { billingApi, type BillingInvoice, type BillingStatus } from './billing';

/**
 * Billing status for the current request, fetched once and shared by the
 * dashboard layout and `requireServerToken`. Best-effort: a failing status
 * call yields null (the backend still enforces the block with 402).
 */
export const readBillingStatus = cache(
  async (accessToken: string): Promise<BillingStatus | null> => {
    try {
      return await billingApi.status({ accessToken });
    } catch (err) {
      console.error('[billing] status request failed', err);
      return null;
    }
  },
);

/** Payment history for the billing page; an empty list if the call fails. */
export async function readBillingInvoices(accessToken: string): Promise<BillingInvoice[]> {
  try {
    return await billingApi.invoices({ accessToken });
  } catch (err) {
    console.error('[billing] invoice history request failed', err);
    return [];
  }
}
