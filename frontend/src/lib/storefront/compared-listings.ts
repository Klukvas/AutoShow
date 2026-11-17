import { publicApi } from '@/lib/api/public';
import type { Currency } from '@/lib/api/types';
import { loadSavedListings, type SavedListings } from './saved-listings';

export type ComparedListings = Readonly<{
  saved: SavedListings;
  /** Currency the prices are compared in; undefined when the branding did not load. */
  baseCurrency: Currency | undefined;
}>;

/**
 * One load of the compare page: the dealer's branding (asked first, as the page always
 * did) beside the compared cars. Never rejects: without branding the cars are still
 * compared, only without a common currency.
 */
export async function loadComparedListings(slugs: readonly string[]): Promise<ComparedListings> {
  const [branding, saved] = await Promise.all([
    publicApi.getBranding({ revalidate: 300 }).catch(() => null),
    loadSavedListings(slugs),
  ]);
  return { baseCurrency: branding?.defaultCurrency, saved };
}
