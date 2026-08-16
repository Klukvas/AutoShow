import type { ListingsQuery } from '@/lib/api/types';

/**
 * Curated collections now live in the backend (GET /api/collections) — a single
 * source drives both the storefront landing pages and the sitemap. This module
 * keeps only the pure URL helper; fetch the collection data via publicApi.
 */

/** /cars URL with a collection's filters applied (for "see all" links). */
export function collectionCatalogHref(query: Partial<ListingsQuery>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  return `/cars?${params.toString()}`;
}
