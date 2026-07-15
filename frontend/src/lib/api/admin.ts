import { apiFetch } from './client';
import type { CursorPage, VehicleOption } from './types';

export type AdminRole = 'admin' | 'editor';

export interface AdminAuthResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    email: string;
    role: AdminRole;
  };
}

export interface AdminLead {
  id: string;
  type: 'callback' | 'message' | 'test_drive' | 'sell_request' | 'credit';
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: 'new' | 'in_progress' | 'done' | 'spam';
  createdAt: string;
  listingId: string | null;
  listing?: { id: string; slug: string; title: string };
  sourceUrl: string | null;
}

export type ListingStatus = 'draft' | 'published' | 'reserved' | 'sold' | 'archived';
export type AdminMediaStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type SellerType = 'own' | 'client';
export type FeeType = 'none' | 'fixed' | 'percent';

export interface AdminReview {
  id: string;
  authorName: string;
  city: string | null;
  text: string;
  rating: number;
  isPublished: boolean;
  position: number;
  createdAt: string;
}

export interface AnalyticsSummary {
  listings: Record<string, number>;
  sales: {
    total: number;
    last30d: number;
    commissionTotal: string;
    commission30d: string;
    commissionPipeline: string;
  };
  leads: { byStatus: Record<string, number>; last30d: number };
  views: {
    total: number;
    top: Array<{ id: string; slug: string; title: string; status: string; viewsCount: number }>;
  };
  salesByMonth: Array<{ month: string; count: number; commission: string }>;
}

export interface AdminMedia {
  id: string;
  status: AdminMediaStatus;
  type?: 'image' | 'video';
  position?: number;
  isCover?: boolean;
  alt?: string | null;
  /** Public URL of the thumb rendition (null until processing finishes). */
  thumbUrl?: string | null;
  originalUrl?: string;
}

export interface AdminListing {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  version: number;
  /** NUMERIC column — arrives as a decimal STRING; coerce before math. */
  priceAmount: string;
  priceCurrency: 'USD' | 'UAH' | 'EUR';
  priceNormalized: string;
  year: number;
  mileageKm: number;
  viewsCount?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  make?: { nameUk: string; slug: string };
  model?: { nameUk: string; slug: string };
  media?: AdminMedia[];
  // Full editable fields (returned by GET /admin/listings/:id, absent from the
  // list projection). Used to prefill the edit form.
  makeId?: string;
  modelId?: string;
  bodyTypeId?: string;
  fuelTypeId?: string;
  transmissionId?: string;
  driveTypeId?: string;
  colorId?: string;
  engineVolumeL?: string;
  powerHp?: number;
  condition?: 'new' | 'used' | 'damaged';
  ownersCount?: number;
  isCrashed?: boolean;
  customsCleared?: boolean;
  isNegotiable?: boolean;
  generation?: string | null;
  modification?: string | null;
  vin?: string | null;
  vinVisible?: boolean;
  description?: string;
  locationCity?: string;
  options?: Array<{ optionId: string }>;
  // Consignment economics (admin-only; NUMERIC columns arrive as strings).
  sellerType?: SellerType;
  sellerName?: string | null;
  sellerPhone?: string | null;
  feeType?: FeeType;
  feePercent?: string | null;
  feeFixedAmount?: string | null;
  salePriceAmount?: string | null;
  commissionAmount?: string | null;
}

export interface AdminListingsQuery {
  q?: string;
  status?: ListingStatus;
  cursor?: string;
  limit?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminCallOpts {
  accessToken: string;
}

export const adminApi = {
  login(body: { email: string; password: string }) {
    return apiFetch<AdminAuthResponse>('/auth/login', {
      method: 'POST',
      body,
    });
  },
  refresh(refreshToken: string) {
    return apiFetch<Omit<AdminAuthResponse, 'user'>>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  },
  logout(refreshToken: string) {
    return apiFetch<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  },

  listListings(query: AdminListingsQuery, opts: AdminCallOpts) {
    return apiFetch<CursorPage<AdminListing>>('/admin/listings', {
      method: 'GET',
      query: { ...query },
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  getListing(id: string, opts: AdminCallOpts) {
    return apiFetch<AdminListing>(`/admin/listings/${id}`, {
      method: 'GET',
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  createListing(body: Record<string, unknown>, opts: AdminCallOpts) {
    return apiFetch<AdminListing>('/admin/listings', {
      method: 'POST',
      body,
      accessToken: opts.accessToken,
    });
  },
  /** Admin-only: creates a vehicle option available to all listings. */
  createCatalogOption(
    body: { nameUk: string; slug: string; category: VehicleOption['category'] },
    opts: AdminCallOpts,
  ) {
    return apiFetch<VehicleOption>('/admin/catalog/options', {
      method: 'POST',
      body,
      accessToken: opts.accessToken,
    });
  },
  updateListing(id: string, body: Record<string, unknown>, opts: AdminCallOpts) {
    return apiFetch<AdminListing>(`/admin/listings/${id}`, {
      method: 'PATCH',
      body,
      accessToken: opts.accessToken,
    });
  },
  transitionListing(
    id: string,
    action: 'publish' | 'archive' | 'mark-sold' | 'reserve' | 'unreserve',
    version: number,
    opts: AdminCallOpts,
    /** mark-sold only: final price → backend stamps the commission. */
    extra?: { salePriceAmount?: number },
  ) {
    return apiFetch<AdminListing>(`/admin/listings/${id}/${action}`, {
      method: 'POST',
      body: { version, ...(extra ?? {}) },
      accessToken: opts.accessToken,
    });
  },
  getAnalyticsSummary(opts: AdminCallOpts) {
    return apiFetch<AnalyticsSummary>('/admin/analytics/summary', {
      accessToken: opts.accessToken,
    });
  },
  listReviews(opts: AdminCallOpts) {
    return apiFetch<AdminReview[]>('/admin/reviews', { accessToken: opts.accessToken });
  },
  createReview(body: Record<string, unknown>, opts: AdminCallOpts) {
    return apiFetch<AdminReview>('/admin/reviews', {
      method: 'POST',
      body,
      accessToken: opts.accessToken,
    });
  },
  updateReview(id: string, body: Record<string, unknown>, opts: AdminCallOpts) {
    return apiFetch<AdminReview>(`/admin/reviews/${id}`, {
      method: 'PATCH',
      body,
      accessToken: opts.accessToken,
    });
  },
  deleteReview(id: string, opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/reviews/${id}`, {
      method: 'DELETE',
      accessToken: opts.accessToken,
    });
  },
  deleteListing(id: string, opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/listings/${id}`, {
      method: 'DELETE',
      accessToken: opts.accessToken,
    });
  },

  // Media
  beginMediaUpload(
    listingId: string,
    body: { type: 'image' | 'video'; contentType: string; filename: string; sizeBytes: number },
    opts: AdminCallOpts,
  ) {
    return apiFetch<{ mediaId: string; uploadUrl: string; key: string; expiresIn: number }>(
      `/admin/listings/${listingId}/media`,
      {
        method: 'POST',
        body,
        accessToken: opts.accessToken,
      },
    );
  },
  confirmMedia(mediaId: string, opts: AdminCallOpts) {
    return apiFetch<{ id: string; status: 'pending' | 'processing' | 'ready' | 'failed' }>(
      `/admin/media/${mediaId}/confirm`,
      {
        method: 'POST',
        accessToken: opts.accessToken,
      },
    );
  },
  reorderMedia(listingId: string, ids: string[], opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/listings/${listingId}/media/reorder`, {
      method: 'PATCH',
      body: { ids },
      accessToken: opts.accessToken,
    });
  },
  setCoverMedia(listingId: string, mediaId: string, opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/listings/${listingId}/media/${mediaId}/cover`, {
      method: 'PATCH',
      accessToken: opts.accessToken,
    });
  },
  deleteMedia(mediaId: string, opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/media/${mediaId}`, {
      method: 'DELETE',
      accessToken: opts.accessToken,
    });
  },

  // Team
  listUsers(opts: AdminCallOpts) {
    return apiFetch<AdminUser[]>('/admin/users', {
      method: 'GET',
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  createUser(
    body: {
      email: string;
      password: string;
    },
    opts: AdminCallOpts,
  ) {
    return apiFetch<AdminUser>('/admin/users', {
      method: 'POST',
      body,
      accessToken: opts.accessToken,
    });
  },
  updateUser(id: string, body: { isActive?: boolean; password?: string }, opts: AdminCallOpts) {
    return apiFetch<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body,
      accessToken: opts.accessToken,
    });
  },
  deleteUser(id: string, opts: AdminCallOpts) {
    return apiFetch<void>(`/admin/users/${id}`, {
      method: 'DELETE',
      accessToken: opts.accessToken,
    });
  },

  // Leads
  listLeads(query: Record<string, string | undefined>, opts: AdminCallOpts) {
    return apiFetch<CursorPage<AdminLead>>('/admin/leads', {
      method: 'GET',
      query,
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  updateLeadStatus(id: string, status: AdminLead['status'], opts: AdminCallOpts) {
    return apiFetch<AdminLead>(`/admin/leads/${id}/status`, {
      method: 'PATCH',
      body: { status },
      accessToken: opts.accessToken,
    });
  },

  // Branding
  getBranding(opts: AdminCallOpts) {
    return apiFetch<import('./types').Branding>('/admin/branding', {
      method: 'GET',
      accessToken: opts.accessToken,
      cache: 'no-store',
    });
  },
  updateBranding(patch: Partial<import('./types').Branding>, opts: AdminCallOpts) {
    return apiFetch<import('./types').Branding>('/admin/branding', {
      method: 'PATCH',
      body: patch,
      accessToken: opts.accessToken,
    });
  },

  // Audit
  listAudit(query: Record<string, string | undefined>, opts: AdminCallOpts) {
    return apiFetch<{ items: Array<Record<string, unknown>>; nextCursor: string | null }>(
      '/admin/audit',
      {
        method: 'GET',
        query,
        accessToken: opts.accessToken,
        cache: 'no-store',
      },
    );
  },
};
