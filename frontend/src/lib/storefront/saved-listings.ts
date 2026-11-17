import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import type { PublicListing } from '@/lib/api/types';

/**
 * What became of one slug a guest saved (favorites, compare) when it was loaded again.
 * `gone` is a confirmed deletion; `failed` is everything that says nothing about the car.
 */
export type SavedListingOutcome =
  | Readonly<{ kind: 'loaded'; listing: PublicListing }>
  | Readonly<{ kind: 'gone'; slug: string }>
  | Readonly<{ kind: 'failed' }>;

/**
 * Only a confirmed 404 means the car is gone: a 500, a timeout or an offline tab
 * must never erase a slug the guest explicitly saved.
 */
export function failedLoadOutcome(slug: string, error: unknown): SavedListingOutcome {
  return error instanceof ApiClientError && error.status === 404
    ? { kind: 'gone', slug }
    : { kind: 'failed' };
}

/** Loads one saved car uncached, so its price and status are current. Never rejects. */
export async function fetchSavedListing(slug: string): Promise<SavedListingOutcome> {
  try {
    return { kind: 'loaded', listing: await publicApi.getListingBySlug(slug, { revalidate: 0 }) };
  } catch (error) {
    return failedLoadOutcome(slug, error);
  }
}

export type SavedListings = Readonly<{
  /** Cars that loaded, in the order the guest saved them. */
  listings: readonly PublicListing[];
  /** Slugs to prune from storage: their cars no longer exist. */
  goneSlugs: readonly string[];
  /** At least one car could not be loaded for a reason other than deletion. */
  hasFailure: boolean;
}>;

export const NO_SAVED_LISTINGS: SavedListings = { listings: [], goneSlugs: [], hasFailure: false };

/** Folds the per-slug outcomes of one load into what the page shows, prunes and retries. */
export function summarizeSavedListings(outcomes: readonly SavedListingOutcome[]): SavedListings {
  return {
    listings: outcomes.flatMap((outcome) => (outcome.kind === 'loaded' ? [outcome.listing] : [])),
    goneSlugs: outcomes.flatMap((outcome) => (outcome.kind === 'gone' ? [outcome.slug] : [])),
    hasFailure: outcomes.some((outcome) => outcome.kind === 'failed'),
  };
}

/**
 * One load of the saved cars: a request per slug, all issued at once in saved order.
 * Never rejects.
 */
export async function loadSavedListings(slugs: readonly string[]): Promise<SavedListings> {
  // Answered without awaiting anything: with nothing saved the page reaches its empty
  // state one microtask after it asked, as it always did, not after extra promise jobs.
  if (slugs.length === 0) return NO_SAVED_LISTINGS;
  return summarizeSavedListings(await Promise.all(slugs.map((slug) => fetchSavedListing(slug))));
}

/**
 * Takes the cars a load confirmed deleted — and only those — out of the guest's storage.
 * One update for the whole batch, so the prunes compose instead of overwriting each
 * other's stale snapshot; no update at all when nothing was deleted.
 */
export function pruneGoneListings(
  saved: SavedListings,
  removeMany: (slugs: string[]) => void,
): void {
  if (saved.goneSlugs.length > 0) removeMany([...saved.goneSlugs]);
}
