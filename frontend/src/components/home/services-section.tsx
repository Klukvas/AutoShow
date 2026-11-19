import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

/**
 * "Послуги" — the showroom's services beyond browsing: instant buyout, trade-in,
 * financing, and multi-channel promotion. Copy lives in messages under
 * home.services.<key>. `image` is a public path the client can replace.
 * Demo photos are free-license stock (Pexels, Unsplash).
 */
const SERVICES = [
  { key: 'buyout', href: '#sell', image: '/demo/services/buyout.jpg' },
  { key: 'tradein', href: '/cars?tags%5B%5D=obmin', image: '/demo/services/tradein.jpg' },
  { key: 'credit', href: '/cars', image: '/demo/services/credit.jpg' },
  { key: 'promo', href: '#sell', image: '/demo/services/promo.jpg' },
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
      <ScrollReveal>
        <HomeSectionHeading title={t('servicesTitle')} />
      </ScrollReveal>
      <ScrollReveal className="home-services-grid">
        {services.map((service, idx) => (
          <ScrollReveal key={service.key} delay={idx * 0.06}>
            <Link href={service.href} className="home-service group focus-ring">
              <span className="home-service-photo">
                <Image
                  src={service.image}
                  alt=""
                  fill
                  sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 25vw"
                  className="object-cover"
                />
              </span>
              <h3 className="home-item-title">{t(`services.${service.key}.title`)}</h3>
              <p className="mt-2 flex-1 text-body-md leading-[1.6] text-ink-2">
                {t(`services.${service.key}.body`)}
              </p>
              <span className="mt-4 text-sub font-semibold text-ink transition-colors group-hover:text-lot-gold">
                {ctaOf(service.key)} →
              </span>
            </Link>
          </ScrollReveal>
        ))}
      </ScrollReveal>
    </section>
  );
}
