import { getTranslations } from 'next-intl/server';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import {
  AVAILABILITY_LABEL_KEYS,
  acceptsLeads,
  breadcrumbsJsonLd,
  listingAvailability,
  listingPrice,
  listingSubLine,
  ownerPhone,
} from './listing-summary';

/**
 * Metadata and the page share this exact request, so Next's fetch memoisation
 * keeps it to one call per render. Null only for a listing that does not exist;
 * any other failure reaches the route's error boundary.
 */
export async function getListing(slug: string) {
  try {
    return await publicApi.getListingBySlug(slug, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

/** Fetch and derive a car page; null when the listing does not exist. */
export async function getListingModel(slug: string) {
  const [listing, branding, t] = await Promise.all([
    getListing(slug),
    getSiteBranding(),
    getTranslations('listing'),
  ]);
  if (!listing) return null;

  const baseCurrency = branding?.defaultCurrency;
  const availability = listingAvailability(listing.status);
  const breadcrumbLabels = { home: t('breadcrumbHome'), catalog: t('breadcrumbCatalog') };

  return {
    t,
    listing,
    branding,
    baseCurrency,
    subLine: listingSubLine(listing),
    ...listingPrice(listing.price, baseCurrency, t('negotiable')),
    availability,
    availabilityLabel: t(AVAILABILITY_LABEL_KEYS[availability]),
    acceptsLeads: acceptsLeads(availability),
    callPhoneOverride: ownerPhone(listing.seller),
    breadcrumbs: [
      { href: '/', label: breadcrumbLabels.home },
      { href: '/cars', label: breadcrumbLabels.catalog },
      { label: listing.title },
    ],
    // Rendered by the route, not by a theme: search engines get the same data for every design.
    structuredData: {
      listing: listing.seo.jsonLd,
      breadcrumbs: breadcrumbsJsonLd(
        { title: listing.title, canonical: listing.seo.canonical },
        breadcrumbLabels,
      ),
    },
  };
}
export type ListingModel = NonNullable<Awaited<ReturnType<typeof getListingModel>>>;
