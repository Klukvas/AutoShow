import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SectionHeading } from '@/components/ui/section-heading';
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

export async function ServicesSection() {
  const t = await getTranslations('home');

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <SectionHeading index="05" title={t('servicesTitle')} />
      <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service, idx) => (
          <ScrollReveal key={service.key} delay={idx * 0.06}>
            <Link
              href={service.href}
              className="focus-ring group flex h-full flex-col rounded-card border border-line bg-bg p-5 transition-colors hover:border-lot-gold"
            >
              <div className="font-mono text-[0.625rem] font-bold tracking-[0.18em] text-lot-gold">
                0{idx + 1}
              </div>
              <h3 className="mt-3 font-heading text-section font-bold text-ink">
                {t(`services.${service.key}.title`)}
              </h3>
              <p className="mt-2 flex-1 text-body-md leading-[1.6] text-ink-2">
                {t(`services.${service.key}.body`)}
              </p>
              <span className="mt-4 text-sub font-semibold text-ink transition-colors group-hover:text-lot-gold">
                {t(`services.${service.key}.cta`)} →
              </span>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
