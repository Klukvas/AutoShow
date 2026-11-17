import { getTranslations } from 'next-intl/server';
import { publicApi } from '@/lib/api/public';
import type { CatalogRef, ListingsQuery } from '@/lib/api/types';
import { getSiteBranding } from '@/lib/branding/resolve';
import {
  MAX_PAGES,
  mergePages,
  nextFanOut,
  readCursorStack,
  type CatalogListings,
  type CursorStack,
} from '@/lib/catalog-cursor';
import { buildCatalogQuery, selectedSingleMake, type CatalogSearchParams } from './catalog-query';
import { catalogResults } from './catalog-results';

/**
 * Fetches every page of the stack in parallel — at most MAX_PAGES requests,
 * root and current cursor included. A failed page is NOT folded into an empty
 * page — the caller renders an explicit error state instead.
 */
async function fetchListings(query: ListingsQuery, stack: CursorStack): Promise<CatalogListings> {
  try {
    // Accumulation always starts at the cursor-less root page; stack entries
    // and the current cursor are the subsequent chunks.
    const cursors: Array<string | undefined> = stack.accumulate
      ? [undefined, ...stack.cursors, ...(query.cursor ? [query.cursor] : [])]
      : query.cursor
        ? [query.cursor]
        : [undefined];
    if (cursors.length === 1) {
      return mergePages([
        await publicApi.listListings({ ...query, cursor: cursors[0] }, { revalidate: 30 }),
      ]);
    }
    const pages = await Promise.all(
      cursors.map((cursor) => publicApi.listListings({ ...query, cursor }, { revalidate: 30 })),
    );
    return mergePages(pages);
  } catch {
    return { ok: false };
  }
}

/** Fetch and derive the catalogue before selecting any presentation. */
export async function getCatalogModel(search: CatalogSearchParams) {
  const t = await getTranslations('catalog');
  const query = buildCatalogQuery(search);
  const cursorStack = readCursorStack(search);
  // Hiding the button at the budget edge is what makes the cap safe: the
  // trail is never truncated on the user path (only crafted URLs are).
  const canLoadMore = nextFanOut(cursorStack, query.cursor) <= MAX_PAGES;

  const [
    listings,
    makes,
    models,
    bodyTypes,
    fuelTypes,
    transmissions,
    driveTypes,
    options,
    tags,
    branding,
  ] = await Promise.all([
    fetchListings(query, cursorStack),
    publicApi.listMakes().catch(() => []),
    publicApi.listModels(undefined).catch(() => []),
    publicApi.listSimpleCatalog<CatalogRef>('body-types').catch(() => []),
    publicApi.listSimpleCatalog<CatalogRef>('fuel-types').catch(() => []),
    publicApi.listSimpleCatalog<CatalogRef>('transmissions').catch(() => []),
    publicApi.listSimpleCatalog<CatalogRef>('drive-types').catch(() => []),
    publicApi.listOptions().catch(() => []),
    publicApi.listTags().catch(() => []),
    getSiteBranding(),
  ]);

  return {
    t,
    baseCurrency: branding?.defaultCurrency,
    filters: { makes, models, bodyTypes, fuelTypes, transmissions, driveTypes, options, tags },
    activeMake: selectedSingleMake(query),
    resultCount: listings.ok ? listings.total : undefined,
    results: catalogResults(listings, canLoadMore, search),
  };
}
export type CatalogModel = Awaited<ReturnType<typeof getCatalogModel>>;
