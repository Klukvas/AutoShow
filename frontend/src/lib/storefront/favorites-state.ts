import type { PublicListing } from '@/lib/api/types';

/**
 * What the favorites page shows. `loading` carries how many cars are saved, so a theme
 * can size its placeholders. `error` means some cars could not be loaded (the saved
 * slugs are kept and a retry is offered); its `listings` are the cars that did load,
 * possibly none.
 */
export type FavoritesState =
  | Readonly<{ status: 'loading'; savedCount: number }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'ready'; listings: readonly PublicListing[] }>
  | Readonly<{ status: 'error'; listings: readonly PublicListing[]; isRetrying: boolean }>;

export function favoritesState(input: {
  /** Cars of the last finished load; null until the first one finishes. */
  listings: readonly PublicListing[] | null;
  hasLoadFailure: boolean;
  isLoading: boolean;
  savedCount: number;
}): FavoritesState {
  const { listings, hasLoadFailure, isLoading, savedCount } = input;
  if (listings === null) return { status: 'loading', savedCount };
  // A failed load is never "empty": the cars may exist, they just did not arrive.
  if (hasLoadFailure) return { status: 'error', listings, isRetrying: isLoading };
  return listings.length > 0 ? { status: 'ready', listings } : { status: 'empty' };
}
