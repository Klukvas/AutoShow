import { getTranslations } from 'next-intl/server';
import { publicApi } from '@/lib/api/public';
import type { Collection, PublicListing } from '@/lib/api/types';
import { getSiteBranding } from '@/lib/branding/resolve';
import { collectionCatalogHref } from '@/lib/collections';

const COLLECTION_PAGE_SIZE = 24;

/** Keys to prerender; an unreachable API prerenders none instead of failing the build. */
export async function listCollectionKeys(): Promise<string[]> {
  try {
    const collections = await publicApi.listCollections();
    return collections.map((collection) => collection.key);
  } catch {
    return [];
  }
}

/**
 * Metadata and the page share this exact request, so Next's fetch memoisation
 * keeps it to one call per render.
 */
export function getCollectionPreset(key: string) {
  return publicApi.getCollection(key).catch(() => null);
}

async function listCollectionListings(query: Collection['query']): Promise<PublicListing[]> {
  try {
    const page = await publicApi.listListings(
      { ...query, sort: 'newest', limit: COLLECTION_PAGE_SIZE },
      { revalidate: 300 },
    );
    return page.items;
  } catch {
    return [];
  }
}

/** Fetch and derive a collection landing; null when the collection does not exist. */
export async function getCollectionModel(key: string) {
  const preset = await getCollectionPreset(key);
  if (!preset) return null;

  const [t, branding] = await Promise.all([getTranslations('catalog'), getSiteBranding()]);
  const items = await listCollectionListings(preset.query);

  return {
    t,
    preset,
    items,
    baseCurrency: branding?.defaultCurrency,
    catalogHref: collectionCatalogHref(preset.query),
  };
}
export type CollectionModel = NonNullable<Awaited<ReturnType<typeof getCollectionModel>>>;
