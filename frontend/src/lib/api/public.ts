import { apiFetch } from './client';
import type {
  Branding,
  CatalogMake,
  CatalogModel,
  CursorPage,
  CreateLeadBody,
  ListingsQuery,
  PublicListing,
  VehicleOption,
} from './types';

interface PublicOpts {
  revalidate?: number;
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

  listMakes() {
    return apiFetch<CatalogMake[]>('/catalog/makes', {
      method: 'GET',
      next: { revalidate: 600, tags: ['catalog:makes'] },
    });
  },

  listModels(makeSlug: string | undefined) {
    return apiFetch<CatalogModel[]>('/catalog/models', {
      method: 'GET',
      query: makeSlug ? { make: makeSlug } : undefined,
      next: { revalidate: 600, tags: ['catalog:models'] },
    });
  },

  listOptions() {
    return apiFetch<VehicleOption[]>('/catalog/options', {
      method: 'GET',
      next: { revalidate: 600, tags: ['catalog:options'] },
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

  submitLead(body: CreateLeadBody) {
    return apiFetch<{ id: string; status: string }>('/leads', {
      method: 'POST',
      body,
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
