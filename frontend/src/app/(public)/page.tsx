import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { HomeHero } from '@/components/hero/home-hero';
import { CollectionsSection } from '@/components/home/collections-section';
import { ReviewsSection } from '@/components/home/reviews-section';
import { ServicesSection } from '@/components/home/services-section';
import { SellCarSection } from '@/components/home/sell-car-section';
import { StatsBand } from '@/components/home/stats-band';
import { ListingCard } from '@/components/listing/listing-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';

export const revalidate = 60;

type HomeSection = 'fresh' | 'collections' | 'trust' | 'reviews' | 'services' | 'sell';

/** Catalogue numbers (№01…) follow the sections actually rendered — fresh
 *  arrivals, collections and reviews hide while empty, and hardcoded numbers
 *  would leave gaps. */
function sectionIndexes(shown: { fresh: boolean; collections: boolean; reviews: boolean }) {
  const visible: HomeSection[] = [
    ...(shown.fresh ? (['fresh'] as const) : []),
    ...(shown.collections ? (['collections'] as const) : []),
    'trust',
    ...(shown.reviews ? (['reviews'] as const) : []),
    'services',
    'sell',
  ];
  return (section: HomeSection) => String(visible.indexOf(section) + 1).padStart(2, '0');
}

export default async function HomePage() {
  const [t, branding, listings, collections, reviews] = await Promise.all([
    getTranslations('home'),
    getSiteBranding(),
    publicApi
      .listListings({ sort: 'newest', limit: 7 }, { revalidate: 60 })
      .then((page) => page.items)
      .catch(() => []),
    publicApi.listCollections().catch(() => []),
    publicApi.listReviews({ revalidate: 300 }).catch(() => []),
  ]);
  const hero = listings[0] ?? null;
  // The newest car is the hero; the grid shows the next six. With nothing left
  // for the grid the section would be a heading over empty space — hide it.
  const rest = listings.slice(1, 7);
  const indexOf = sectionIndexes({
    fresh: rest.length > 0,
    collections: collections.length > 0,
    reviews: reviews.length > 0,
  });

  return (
    <>
      <HomeHero
        listing={hero}
        title={branding?.tagline ?? t('heroFallbackTitle')}
        subtitle={t('heroSub')}
      />

      {/* Fresh arrivals */}
      {rest.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
          <SectionHeading
            index={indexOf('fresh')}
            title={t('freshArrivals')}
            action={
              <Button as="link" href="/cars" variant="ghost" size="sm">
                {t('viewAll')} →
              </Button>
            }
          />

          <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((listing, idx) => (
              <ScrollReveal key={listing.id} delay={Math.min(idx, 5) * 0.05}>
                <ListingCard
                  listing={listing}
                  priority={idx < 2}
                  baseCurrency={branding?.defaultCurrency}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      <StatsBand />

      <CollectionsSection collections={collections} index={indexOf('collections')} />

      {/* Trust block */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
          <SectionHeading index={indexOf('trust')} title={t('trustEyebrow')} />
          <div className="mt-6 grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {[
              { title: t('trust1Title'), body: t('trust1Body') },
              { title: t('trust2Title'), body: t('trust2Body') },
              { title: t('trust3Title'), body: t('trust3Body') },
            ].map((card, idx) => (
              <ScrollReveal key={card.title} delay={idx * 0.06}>
                <div className="h-full rounded-card border border-line bg-bg p-5">
                  <h3 className="font-heading text-section font-bold text-ink">{card.title}</h3>
                  <p className="mt-2 text-body-md text-ink-2">{card.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <ReviewsSection reviews={reviews} index={indexOf('reviews')} />

      <ServicesSection index={indexOf('services')} />

      <SellCarSection index={indexOf('sell')} />
    </>
  );
}
