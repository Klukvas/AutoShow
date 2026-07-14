import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import { Breadcrumbs } from '@/components/listing/breadcrumbs';
import { ContactPanel } from '@/components/listing/contact-panel';
import { Gallery } from '@/components/listing/gallery';
import { KeySpecs } from '@/components/listing/key-specs';
import { MobileCtaBar } from '@/components/listing/mobile-cta-bar';
import { OptionsByCategory } from '@/components/listing/options-by-category';
import { ShareButton } from '@/components/listing/share-button';
import { SimilarCars } from '@/components/listing/similar-cars';
import { SpecTable } from '@/components/listing/spec-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ViewBeacon } from '@/components/listing/view-beacon';
import { LeadForm } from '@/components/lead/lead-form';
import { LEAD_FORM_ID } from '@/components/lead/lead-cta';
import { formatMoney, formatYear } from '@/lib/format';
import { formatPriceNote } from '@/lib/listing-price';
import { JsonLd } from '@/lib/seo/json-ld';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadListing(slug: string) {
  try {
    return await publicApi.getListingBySlug(slug, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [listing, branding] = await Promise.all([loadListing(slug), getSiteBranding()]);
  if (!listing) return {};
  const titleBase = listing.seo.metaTitle ?? listing.title;
  // Same eligibility rule as the gallery: first IMAGE with processed renditions
  // (media[0] may be a video or an unprocessed upload).
  const ogMedia = listing.media.find((m) => m.type === 'image' && (m.renditions?.length ?? 0) > 0);
  const ogImage = ogMedia?.renditions.find((r) => r.variant === 'full' && r.format === 'jpeg')?.url;
  return {
    title: titleBase,
    description: listing.seo.metaDescription ?? branding?.seoDefaults?.description,
    alternates: { canonical: listing.seo.canonical },
    openGraph: {
      title: titleBase,
      description: listing.seo.metaDescription ?? undefined,
      url: listing.seo.canonical,
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;
  const [listing, branding, t] = await Promise.all([
    loadListing(slug),
    getSiteBranding(),
    getTranslations('listing'),
  ]);
  if (!listing) notFound();

  const subLine = [
    formatYear(listing.year),
    listing.bodyType?.nameUk ?? null,
    listing.location.city,
  ]
    .filter(Boolean)
    .join(' · ');

  const price = formatMoney(listing.price.amount, listing.price.currency);
  const baseCurrency = branding?.defaultCurrency;
  const priceNote = formatPriceNote(listing.price, baseCurrency, t('negotiable'));

  const availability =
    listing.status === 'sold' ? 'sold' : listing.status === 'reserved' ? 'reserved' : 'available';
  const availabilityLabel =
    listing.status === 'sold'
      ? t('statusSold')
      : listing.status === 'reserved'
        ? t('statusReserved')
        : t('statusAvailable');
  // A sold car takes no inquiries — the page stays up as social proof.
  const acceptsLeads = listing.status !== 'sold';

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-4 md:px-8 md:pb-16 md:pt-6">
      <JsonLd data={listing.seo.jsonLd} />
      <ViewBeacon listingId={listing.id} />

      {/* Desktop header: breadcrumbs → H1 + status + share */}
      <div className="hidden md:block">
        <Breadcrumbs
          items={[
            { href: '/', label: t('breadcrumbHome') },
            { href: '/cars', label: t('breadcrumbCatalog') },
            { label: listing.title },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-title-lg font-extrabold text-ink">{listing.title}</h1>
          <StatusBadge status={availability}>{availabilityLabel}</StatusBadge>
          <div className="ml-auto">
            <ShareButton title={listing.title} />
          </div>
        </div>
        <p className="mt-1.5 text-body-md text-ink-2">{subLine}</p>
      </div>

      <div className="mt-0 gap-8 md:mt-6 md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        {/* Left column: gallery + content */}
        <div>
          <Gallery media={listing.media} title={listing.title} backHref="/cars" />

          {/* Mobile header (handoff 1g): title → badge → sub → price → key specs */}
          <div className="mt-4 space-y-3 md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="font-heading text-title-sm font-extrabold text-ink">
                {listing.title}
              </h1>
              <StatusBadge status={availability}>{availabilityLabel}</StatusBadge>
            </div>
            <p className="text-sub text-ink-2">{subLine}</p>
            <div>
              <div className="tabular font-heading text-price-md font-extrabold text-ink">
                {price}
              </div>
              {priceNote && <p className="mt-0.5 text-sub text-ink-2">{priceNote}</p>}
            </div>
            <KeySpecs listing={listing} t={t} />
          </div>

          <section className="mt-8">
            <h2 className="font-heading text-section font-bold text-ink">{t('specsTitle')}</h2>
            <div className="mt-3">
              <SpecTable listing={listing} t={t} />
            </div>
          </section>

          {listing.options.length > 0 && (
            <section className="mt-8">
              <h2 className="font-heading text-section font-bold text-ink">{t('optionsTitle')}</h2>
              <div className="mt-4">
                <OptionsByCategory options={listing.options} t={t} />
              </div>
            </section>
          )}

          {listing.description && (
            <section className="mt-8">
              <h2 className="font-heading text-section font-bold text-ink">
                {t('descriptionTitle')}
              </h2>
              <p className="mt-3 max-w-[640px] whitespace-pre-wrap text-body-md leading-[1.75] text-ink-2">
                {listing.description}
              </p>
            </section>
          )}

          {acceptsLeads && (
            <section id={LEAD_FORM_ID} className="mt-10 scroll-mt-24">
              <LeadForm listingId={listing.id} variant="callback" />
            </section>
          )}
        </div>

        {/* Right column: sticky contact panel (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-[86px]">
            <ContactPanel listing={listing} branding={branding} />
          </div>
        </aside>
      </div>

      <SimilarCars listing={listing} baseCurrency={baseCurrency} />
      <MobileCtaBar
        branding={branding}
        acceptsLeads={acceptsLeads}
        phoneOverride={listing.seller.type === 'client' ? listing.seller.phone : undefined}
      />
    </div>
  );
}
