import { LEAD_FORM_ID } from '@/components/lead/lead-cta';
import { LeadForm } from '@/components/lead/lead-form';
import { Breadcrumbs } from '@/components/listing/breadcrumbs';
import { ContactPanel } from '@/components/listing/contact-panel';
import { CreditCalculator } from '@/components/listing/credit-calculator';
import { FavoriteButton } from '@/components/listing/favorite-button';
import { Gallery } from '@/components/listing/gallery';
import { KeySpecs } from '@/components/listing/key-specs';
import { MobileCtaBar } from '@/components/listing/mobile-cta-bar';
import { OptionsByCategory } from '@/components/listing/options-by-category';
import { ShareButton } from '@/components/listing/share-button';
import { SimilarCars } from '@/components/listing/similar-cars';
import { SpecTable } from '@/components/listing/spec-table';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ListingProps } from '../contract';

/** Existing car page markup: header, gallery, specs, lead capture, similar cars. */
export function Listing({ model }: ListingProps) {
  const {
    t,
    listing,
    branding,
    baseCurrency,
    subLine,
    price,
    priceNote,
    availability,
    availabilityLabel,
    acceptsLeads,
    callPhoneOverride,
    breadcrumbs,
  } = model;
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-4 md:px-8 md:pb-16 md:pt-6">
      {/* Desktop header: breadcrumbs → H1 + status + share */}
      <div className="hidden md:block">
        <Breadcrumbs items={breadcrumbs} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-title-lg font-medium text-ink">{listing.title}</h1>
          <StatusBadge status={availability}>{availabilityLabel}</StatusBadge>
          <span className="inline-flex items-center gap-1.5 text-sub text-ink-3" aria-live="off">
            <ViewsIcon />
            {t('viewsCount', { count: listing.viewsCount })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <FavoriteButton slug={listing.slug} variant="inline" />
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
              <h1 className="font-heading text-title-sm font-medium text-ink">{listing.title}</h1>
              <StatusBadge status={availability}>{availabilityLabel}</StatusBadge>
            </div>
            <p className="text-sub text-ink-2">
              {subLine} · {t('viewsCount', { count: listing.viewsCount })}
            </p>
            <div>
              <div className="tabular font-heading text-price-md font-medium text-ink">{price}</div>
              {priceNote && <p className="mt-0.5 text-sub text-ink-2">{priceNote}</p>}
            </div>
            <KeySpecs listing={listing} t={t} />
          </div>

          {listing.tags.length > 0 && (
            <section className="mt-8">
              <SectionHeading size="sm" title={t('tagsTitle')} />
              <ul className="mt-4 flex flex-wrap gap-2">
                {listing.tags.map((tag) => (
                  <li
                    key={tag.slug}
                    className="rounded-chip border border-line px-2.5 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-2"
                  >
                    {tag.nameUk}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <SectionHeading size="sm" title={t('specsTitle')} />
            <div className="mt-4">
              <SpecTable listing={listing} t={t} />
            </div>
          </section>

          {listing.options.length > 0 && (
            <section className="mt-8">
              <SectionHeading size="sm" title={t('optionsTitle')} />
              <div className="mt-4">
                <OptionsByCategory options={listing.options} t={t} />
              </div>
            </section>
          )}

          {listing.description && (
            <section className="mt-8">
              <SectionHeading size="sm" title={t('descriptionTitle')} />
              <p className="mt-4 max-w-[640px] whitespace-pre-wrap text-body-md leading-[1.75] text-ink-2">
                {listing.description}
              </p>
            </section>
          )}

          {acceptsLeads && (
            <>
              <section className="mt-8">
                <CreditCalculator
                  listingId={listing.id}
                  priceAmount={listing.price.amount}
                  currency={listing.price.currency}
                />
              </section>
              <section id={LEAD_FORM_ID} className="mt-10 scroll-mt-24">
                <LeadForm listingId={listing.id} variant="callback" />
              </section>
            </>
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
        phoneOverride={callPhoneOverride}
      />
    </div>
  );
}

function ViewsIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden
    >
      <path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.9" />
    </svg>
  );
}
