/**
 * Frontend mirror of the backend contracts (AutoFlow Backend v2). Kept
 * minimal — only the fields we actually consume in the UI. When the backend
 * adds a field we want to render, extend here rather than rely on raw `any`.
 */

export type Currency = 'USD' | 'UAH' | 'EUR';

export interface CatalogRef {
  id: string;
  slug: string;
  nameUk: string;
  nameEn: string | null;
}

export interface MediaRendition {
  url: string;
  width: number;
  height: number;
  format: 'webp' | 'avif' | 'jpeg';
  variant: 'thumb' | 'gallery' | 'full';
  bytes: number;
}

export interface PublicMedia {
  id: string;
  type: 'image' | 'video';
  position: number;
  isCover: boolean;
  alt: string | null;
  originalUrl: string;
  renditions: MediaRendition[];
}

export interface PublicListing {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'published' | 'reserved' | 'sold';
  /** Own showroom car (contacts = branding) vs client's car (owner contacts). */
  seller: { type: 'own' | 'client'; name: string | null; phone: string | null };
  make: CatalogRef;
  model: CatalogRef;
  generation: string | null;
  modification: string | null;
  year: number;
  mileageKm: number;
  vin: string | null;
  bodyType: CatalogRef | null;
  fuelType: CatalogRef | null;
  transmission: CatalogRef | null;
  driveType: CatalogRef | null;
  color: CatalogRef | null;
  engineVolumeL: string;
  powerHp: number;
  condition: 'new' | 'used' | 'damaged';
  ownersCount: number;
  isCrashed: boolean;
  customsCleared: boolean;
  price: {
    amount: string;
    currency: Currency;
    normalized: string;
    isNegotiable: boolean;
  };
  location: { city: string; region: string | null };
  publishedAt: string | null;
  viewsCount: number;
  media: PublicMedia[];
  options: Array<{ slug: string; nameUk: string; category: string }>;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    canonical: string;
    jsonLd: Record<string, unknown>;
  };
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  /** Total rows matching the filters (independent of the cursor window). */
  total?: number;
}

export interface Branding {
  id: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  displayName: string;
  tagline: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  workingHours: Record<string, { open: string; close: string } | null> | null;
  socialLinks: Record<string, string> | null;
  seoDefaults: { titleTemplate?: string; description?: string; ogImage?: string } | null;
  defaultCurrency: Currency;
}

export interface CatalogMake extends CatalogRef {}
export interface CatalogModel extends CatalogRef {
  makeId: string;
  make?: CatalogMake;
}
export interface VehicleOption extends CatalogRef {
  category: 'comfort' | 'safety' | 'multimedia' | 'interior' | 'exterior' | 'other';
}

export interface ListingsQuery {
  q?: string;
  make?: string;
  model?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  condition?: 'new' | 'used' | 'damaged';
  city?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  options?: string[];
  sort?: 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc' | 'mileage_asc' | 'newest';
  cursor?: string;
  limit?: number;
}

export interface CreateLeadBody {
  type: 'callback' | 'message' | 'test_drive' | 'sell_request' | 'credit';
  name: string;
  phone: string;
  email?: string;
  message?: string;
  listingId?: string;
  sourceUrl?: string;
  utm?: Record<string, string>;
  // sell_request: the visitor's own car
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carMileageKm?: number;
  // credit: calculator inputs
  creditDownPayment?: number;
  creditTermMonths?: number;
  /** Honeypot — must be empty. */
  website?: string;
}

export interface PublicReview {
  id: string;
  authorName: string;
  city: string | null;
  text: string;
  rating: number;
  createdAt: string;
}

export interface PublicStats {
  available: number;
  sold: number;
  views: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId?: string;
  path?: string;
}
