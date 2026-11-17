import type { PublicListing } from '@/lib/api/types';
import type { CatalogListings } from '@/lib/catalog-cursor';
import { catalogHref, type CatalogSearchParams } from './catalog-query';

/** What follows the grid: a "load more" button, or why the list stops early. */
export type CatalogContinuation =
  | { kind: 'load-more'; nextCursor: string }
  | { kind: 'limit-reached'; shownCount: number }
  | null;

/**
 * The listings request is the only one whose failure is shown: a down API must
 * never be mistaken for an honest zero-result filter.
 */
export type CatalogResults =
  | { status: 'error'; retryHref: string }
  | { status: 'empty'; continuation: CatalogContinuation }
  | {
      status: 'found';
      items: readonly PublicListing[];
      /** Index of the first card from the newest page (scroll target). */
      newStartIndex: number | null;
      continuation: CatalogContinuation;
    };

function continuationOf(
  listings: Extract<CatalogListings, { ok: true }>,
  canLoadMore: boolean,
): CatalogContinuation {
  if (!listings.nextCursor) return null;
  return canLoadMore
    ? { kind: 'load-more', nextCursor: listings.nextCursor }
    : { kind: 'limit-reached', shownCount: listings.items.length };
}

/** Discriminates the error, empty and found states the views render. */
export function catalogResults(
  listings: CatalogListings,
  canLoadMore: boolean,
  search: CatalogSearchParams,
): CatalogResults {
  if (!listings.ok) return { status: 'error', retryHref: catalogHref(search) };
  const continuation = continuationOf(listings, canLoadMore);
  if (listings.items.length === 0) return { status: 'empty', continuation };
  return {
    status: 'found',
    items: listings.items,
    newStartIndex: listings.newStartIndex,
    continuation,
  };
}
