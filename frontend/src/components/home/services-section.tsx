import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

/**
 * "Послуги" — the showroom's services beyond browsing: instant buyout, trade-in,
 * financing, and multi-channel promotion. Copy lives in messages/uk.json under
 * home.services.<key>; each card links into the relevant existing flow (the
 * consignment form #sell, the trade-in tag filter, or contacts).
 */
const SERVICES = [
  // buyout/promo → the #sell intake form (captures the car); tradein → the
  // "Обмін" tag filter; credit → the catalog, where the per-car calculator lives.
  { key: 'buyout', href: '#sell' },
  { key: 'tradein', href: '/cars?tags%5B%5D=obmin' },
  { key: 'credit', href: '/cars' },
  { key: 'promo', href: '#sell' },
] as const;

export async function ServicesSection({ hasPackages }: { hasPackages: boolean }) {
  const t = await getTranslations('home');
  // With tariffs on the page, "promo" opens them instead of the bare intake form.
  const services = SERVICES.map((service) =>
    service.key === 'promo' && hasPackages ? { ...service, href: '#packages' } : service,
  );
  const ctaOf = (key: (typeof SERVICES)[number]['key']) =>
    key === 'promo' && hasPackages ? t('services.promo.ctaPackages') : t(`services.${key}.cta`);

  return (
    <section className="home-container home-section">
      <HomeSectionHeading title={t('servicesTitle')} />
      <div className="home-services-grid">
        {services.map((service, idx) => (
          <ScrollReveal key={service.key} delay={idx * 0.06}>
            <Link
              href={service.href}
              className="home-service focus-ring"
            >
              <h3 className="home-item-title">
                {t(`services.${service.key}.title`)}
              </h3>
              <p className="mt-2 flex-1 text-body-md leading-[1.6] text-ink-2">
                {t(`services.${service.key}.body`)}
              </p>
              <span className="mt-4 text-sub font-semibold text-ink transition-colors group-hover:text-lot-gold">
                {ctaOf(service.key)} →
              </span>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
