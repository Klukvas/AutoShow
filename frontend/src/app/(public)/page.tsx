import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { HomeHero } from '@/components/hero/home-hero';
import { CollectionsSection } from '@/components/home/collections-section';
import { ReviewsSection } from '@/components/home/reviews-section';
import { SellCarSection } from '@/components/home/sell-car-section';
import { StatsBand } from '@/components/home/stats-band';
import { ListingCard } from '@/components/listing/listing-card';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';

export const revalidate = 60;

export default async function HomePage() {
  const [t, branding] = await Promise.all([getTranslations('home'), getSiteBranding()]);

  let listings: Awaited<ReturnType<typeof publicApi.listListings>>['items'] = [];
  try {
    const page = await publicApi.listListings({ sort: 'newest', limit: 7 }, { revalidate: 60 });
    listings = page.items;
  } catch {
    listings = [];
  }
  const hero = listings[0] ?? null;
  const rest = listings.slice(1, 7);

  return (
    <>
      <HomeHero
        listing={hero}
        title={branding?.tagline ?? t('heroFallbackTitle')}
        subtitle={t('heroSub')}
      />

      {/* Fresh arrivals */}
      <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-heading text-title-lg font-extrabold text-ink">
            {t('freshArrivals')}
          </h2>
          <Button as="link" href="/cars" variant="ghost" size="sm">
            {t('viewAll')} →
          </Button>
        </div>

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

      <StatsBand />

      <CollectionsSection />

      {/* Trust block */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
          <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t('trustEyebrow')}
          </p>
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

      <ReviewsSection />

      <SellCarSection />
    </>
  );
}
