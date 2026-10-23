import Link from 'next/link';
import { HomeHero } from '@/components/hero/home-hero';
import { CollectionsSection } from '@/components/home/collections-section';
import { ReviewsSection } from '@/components/home/reviews-section';
import { ServicesSection } from '@/components/home/services-section';
import { SellCarSection } from '@/components/home/sell-car-section';
import { StatsBand } from '@/components/home/stats-band';
import { HomeSectionHeading } from '@/components/home/home-section-heading';
import { PackagesSection } from '@/components/home/packages-section';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

import type { HomeModel } from '@/lib/installation/home-model';
import type { InventoryCardComponent } from './inventory-card';

/** Existing default markup, shared by presentation variants through named slots. */
export function HomeView({
  model,
  InventoryCard,
}: {
  model: HomeModel;
  InventoryCard: InventoryCardComponent;
}) {
  const { installation, t, branding, hero, inventory, collections, reviews, packages } = model;
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
                <InventoryCard
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

      {installation.features.reviews && <ReviewsSection reviews={reviews} />}

      <ServicesSection hasPackages={packages.length > 0} />

      <PackagesSection packages={packages} />

      <SellCarSection packages={packages} />
    </>
  );
}
