import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { HomeHero } from '@/components/hero/home-hero';
import { CollectionsSection } from '@/components/home/collections-section';
import { ReviewsSection } from '@/components/home/reviews-section';
import { ServicesSection } from '@/components/home/services-section';
import { SellCarSection } from '@/components/home/sell-car-section';
import { StatsBand } from '@/components/home/stats-band';
import { ListingCard } from '@/components/listing/listing-card';
import { HomeSectionHeading } from '@/components/home/home-section-heading';
import { PackagesSection } from '@/components/home/packages-section';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';

export const revalidate = 60;

export default async function HomePage() {
  const [t, branding, listings, collections, reviews, packages] = await Promise.all([
    getTranslations('home'),
    getSiteBranding(),
    publicApi
      .listListings({ sort: 'newest', limit: 7 }, { revalidate: 60 })
      .then((page) => page.items)
      .catch(() => []),
    publicApi.listCollections().catch(() => []),
    publicApi.listReviews({ revalidate: 300 }).catch(() => []),
    publicApi.listPlacementPackages({ revalidate: 60 }).catch(() => []),
  ]);
  const hero = listings[0] ?? null;
  const inventory = listings.slice(0, 6);

  return (
    <>
      <HomeHero
        listing={hero}
        title={t('cinematicTitle')}
        subtitle={branding?.tagline ?? t('cinematicSubtitle')}
        baseCurrency={branding?.defaultCurrency}
      />

      {/* Current inventory, including the featured car. */}
      {inventory.length > 0 && (
        <section className="home-container home-section home-inventory">
          <HomeSectionHeading
            title={t('cinematicInventory')}
            action={
              <Link href="/cars" className="home-text-link focus-ring">
                {t('cinematicViewAll')} <span aria-hidden>↗</span>
              </Link>
            }
          />

          <div className="home-inventory-grid">
            {inventory.map((listing, idx) => (
              <ScrollReveal key={listing.id} delay={Math.min(idx, 5) * 0.05}>
                <ListingCard
                  listing={listing}
                  variant="cinematic"
                  priority={idx < 2}
                  baseCurrency={branding?.defaultCurrency}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      <StatsBand />

      <CollectionsSection collections={collections} />

      {/* Trust block */}
      <section className="home-trust">
        <div className="home-container home-section">
          <HomeSectionHeading title={t('trustEyebrow')} />
          <div className="home-trust-grid">
            {[
              { title: t('trust1Title'), body: t('trust1Body') },
              { title: t('trust2Title'), body: t('trust2Body') },
              { title: t('trust3Title'), body: t('trust3Body') },
            ].map((card, idx) => (
              <ScrollReveal key={card.title} delay={idx * 0.06}>
                <div className="home-trust-item">
                  <h3 className="home-item-title">{card.title}</h3>
                  <p className="mt-2 text-body-md text-ink-2">{card.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <ReviewsSection reviews={reviews} />

      <ServicesSection hasPackages={packages.length > 0} />

      <PackagesSection packages={packages} />

      <SellCarSection packages={packages} />
    </>
  );
}
