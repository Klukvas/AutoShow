import { apiFetch } from './client';
import type {
  Branding,
  CatalogMake,
  CatalogModel,
  CatalogTag,
  Collection,
  CursorPage,
  CreateLeadBody,
  ListingsQuery,
  PublicListing,
  PublicPlacementPackage,
  PublicReview,
  PublicStats,
  VehicleOption,
} from './types';

interface PublicOpts {
  revalidate?: number;
}

interface SubmitLeadOpts {
  /** Key for one form draft; a retry with the same value must not duplicate the lead. */
  idempotencyKey?: string;
}

/**
 * Key that identifies one form draft across retries. `crypto.randomUUID()` is
 * only exposed in secure contexts, and installations are regularly opened over
 * plain `http://` on a LAN address, so fall back to time + randomness instead of
 * throwing away the dedup guarantee.
 */
export function createIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/** Public storefront calls. RSC fetches lean on Next's fetch cache (revalidate + tags). */
export const publicApi = {
  listListings(query: ListingsQuery, opts: PublicOpts = {}) {
    return apiFetch<CursorPage<PublicListing>>('/listings', {
      method: 'GET',
      query: query as Record<string, string | number | string[] | undefined>,
      next: { revalidate: opts.revalidate ?? 30, tags: ['listings'] },
    });
  },

  getListingBySlug(slug: string, opts: PublicOpts = {}) {
    return apiFetch<PublicListing>(`/listings/${encodeURIComponent(slug)}`, {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 60, tags: ['listing', `listing:${slug}`] },
    });
  },

  getBranding(opts: PublicOpts = {}) {
    return apiFetch<Branding>('/branding', {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 300, tags: ['branding'] },
    });
  },

  listCollections(opts: PublicOpts = {}) {
    return apiFetch<Collection[]>('/collections', {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 300, tags: ['collections'] },
    });
  },

  getCollection(key: string, opts: PublicOpts = {}) {
    return apiFetch<Collection>(`/collections/${encodeURIComponent(key)}`, {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 300, tags: ['collections', `collection:${key}`] },
    });
  },

  listMakes() {
    return apiFetch<CatalogMake[]>('/catalog/makes', {
      method: 'GET',
      cache: 'no-store',
    });
  },

  listModels(makeSlug: string | undefined) {
    return apiFetch<CatalogModel[]>('/catalog/models', {
      method: 'GET',
      query: makeSlug ? { make: makeSlug } : undefined,
      cache: 'no-store',
    });
  },

  listOptions() {
    return apiFetch<VehicleOption[]>('/catalog/options', {
      method: 'GET',
      next: { revalidate: 600, tags: ['catalog:options'] },
    });
  },

  listTags() {
    return apiFetch<CatalogTag[]>('/catalog/tags', {
      method: 'GET',
      next: { revalidate: 600, tags: ['catalog:tags'] },
    });
  },

  listSimpleCatalog<T>(
    endpoint: 'body-types' | 'fuel-types' | 'transmissions' | 'drive-types' | 'colors',
  ) {
    return apiFetch<T[]>(`/catalog/${endpoint}`, {
      method: 'GET',
      next: { revalidate: 600, tags: [`catalog:${endpoint}`] },
    });
  },

  listReviews(opts: PublicOpts = {}) {
    return apiFetch<PublicReview[]>('/reviews', {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 300, tags: ['reviews'] },
    });
  },

  listPlacementPackages(opts: PublicOpts = {}) {
    return apiFetch<PublicPlacementPackage[]>('/placement-packages', {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 60, tags: ['placement-packages'] },
    });
  },

  getStats(opts: PublicOpts = {}) {
    return apiFetch<PublicStats>('/stats', {
      method: 'GET',
      next: { revalidate: opts.revalidate ?? 300, tags: ['stats'] },
    });
  },

  /**
   * `idempotencyKey` travels in the `Idempotency-Key` header (not the body) so
   * the DTO stays untouched and older callers keep working without a key.
   */
  submitLead(body: CreateLeadBody, opts: SubmitLeadOpts = {}) {
    return apiFetch<{ id: string; status: string }>('/leads', {
      method: 'POST',
      body,
      ...(opts.idempotencyKey ? { headers: { 'Idempotency-Key': opts.idempotencyKey } } : {}),
    });
  },

  /** Client-fired view beacon — sent from the browser so the backend sees the
   *  real visitor IP for dedup (the cached RSC read cannot). */
  trackView(listingId: string) {
    return apiFetch<void>(`/listings/${encodeURIComponent(listingId)}/view`, {
      method: 'POST',
      cache: 'no-store',
    });
  },
};
