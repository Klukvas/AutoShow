import type { ListingAvailability } from '@/components/ui/status-badge';
import type { Currency, PublicListing } from '@/lib/api/types';
import { formatMoney, formatYear } from '@/lib/format';
import { formatPriceNote } from '@/lib/listing-price';

/** "2019 · Седан · Київ" under the title; a listing without a body type skips that part. */
export function listingSubLine(
  listing: Pick<PublicListing, 'year' | 'bodyType' | 'location'>,
): string {
  return [formatYear(listing.year), listing.bodyType?.nameUk ?? null, listing.location.city]
    .filter(Boolean)
    .join(' · ');
}

/** The big price in the listing's own currency and the "≈ … · торг" note under it. */
export function listingPrice(
  price: PublicListing['price'],
  baseCurrency: Currency | undefined,
  negotiableLabel: string,
): { price: string; priceNote: string | null } {
  return {
    price: formatMoney(price.amount, price.currency),
    priceNote: formatPriceNote(price, baseCurrency, negotiableLabel),
  };
}

/** Every status that is neither sold nor reserved is shown as available. */
export function listingAvailability(status: PublicListing['status']): ListingAvailability {
  if (status === 'sold') return 'sold';
  return status === 'reserved' ? 'reserved' : 'available';
}

/** Message key (namespace `listing`) of each availability badge label. */
export const AVAILABILITY_LABEL_KEYS = {
  available: 'statusAvailable',
  reserved: 'statusReserved',
  sold: 'statusSold',
} as const satisfies Record<ListingAvailability, string>;

/** A sold car takes no inquiries — its page stays up as social proof. */
export function acceptsLeads(availability: ListingAvailability): boolean {
  return availability !== 'sold';
}

/** Client (consignment) cars are called on the owner's phone, not the showroom's. */
export function ownerPhone(seller: PublicListing['seller']): string | null | undefined {
  return seller.type === 'client' ? seller.phone : undefined;
}

/**
 * Mirrors the visible breadcrumbs — lets search results render the
 * Головна → Каталог → car trail instead of a bare URL.
 */
export function breadcrumbsJsonLd(
  listing: { title: string; canonical: string },
  labels: { home: string; catalog: string },
): Record<string, unknown> {
  const siteOrigin = new URL(listing.canonical).origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: labels.home, item: siteOrigin },
      { '@type': 'ListItem', position: 2, name: labels.catalog, item: `${siteOrigin}/cars` },
      { '@type': 'ListItem', position: 3, name: listing.title, item: listing.canonical },
    ],
  };
}
