import { formatMoney } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

/**
 * "≈ 5 890 000 ₴ · торг доречний" note under the big price. The approximation
 * only appears when the site base currency differs from the listing currency;
 * the negotiable label is appended when the price is negotiable. Returns null
 * when there is nothing to say. Shared by the contact panel and the mobile
 * price block so the two can't drift.
 */
export function formatPriceNote(
  price: PublicListing['price'],
  baseCurrency: Currency | undefined,
  negotiableLabel: string,
): string | null {
  const approx =
    baseCurrency && baseCurrency !== price.currency
      ? `≈ ${formatMoney(price.normalized, baseCurrency)}`
      : null;
  const note = [approx, price.isNegotiable ? negotiableLabel : null].filter(Boolean).join(' · ');
  return note || null;
}
