import Link from 'next/link';
import { HomeHero } from '@/components/hero/home-hero';
import { AboutBand } from '@/components/home/about-band';
import { CollectionsSection } from '@/components/home/collections-section';
import { CtaBand } from '@/components/home/cta-band';
import { FaqSection } from '@/components/home/faq-section';
import { ReviewsSection } from '@/components/home/reviews-section';
import { ServicesSection } from '@/components/home/services-section';
import { SellCarSection } from '@/components/home/sell-car-section';
import { StatsBand } from '@/components/home/stats-band';
import { HomeSectionHeading } from '@/components/home/home-section-heading';
import { PackagesSection } from '@/components/home/packages-section';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import type { HomeProps } from '../contract';

/** Existing default markup, shared by themes through named slots. */
export function Home({ model, InventoryCard }: HomeProps) {
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
          <ScrollReveal>
            <HomeSectionHeading
              title={t('cinematicInventory')}
              action={
                <Link href="/cars" className="home-text-link focus-ring">
                  {t('cinematicViewAll')} <span aria-hidden>↗</span>
                </Link>
              }
            />
          </ScrollReveal>

          <ScrollReveal className="home-inventory-grid">
            {inventory.map((listing, idx) => (
              <ScrollReveal key={listing.id} delay={Math.min(idx, 5) * 0.05}>
                <InventoryCard
                  listing={listing}
                  priority={idx < 2}
                  baseCurrency={branding?.defaultCurrency}
                />
              </ScrollReveal>
            ))}
          </ScrollReveal>
        </section>
      )}

      <ScrollReveal>
        <StatsBand animate />
      </ScrollReveal>

      <CollectionsSection collections={collections} />

      <CtaBand
        phone={branding?.contactPhone ?? null}
        telegram={branding?.socialLinks?.telegram ?? null}
      />

      {/* Trust block */}
      <section className="home-trust">
        <div className="home-container home-section">
          <ScrollReveal>
            <HomeSectionHeading title={t('trustEyebrow')} />
          </ScrollReveal>
          <ScrollReveal className="home-trust-grid">
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
          </ScrollReveal>
        </div>
      </section>

      <AboutBand />

      {installation.features.reviews && <ReviewsSection reviews={reviews} />}

      <ServicesSection hasPackages={packages.length > 0} />

      <PackagesSection packages={packages} />

      <SellCarSection packages={packages} />

      <FaqSection />
    </>
  );
}
