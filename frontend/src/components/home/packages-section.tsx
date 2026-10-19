import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { PackagePickLink } from './package-pick-link';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import type { PublicPlacementPackage } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

/**
 * "Тарифи розміщення" — paid placement in the salon's own channels for owners
 * who sell by themselves. Packages are admin-curated; with none published the
 * section is not rendered at all. "Обрати" preselects the package in the
 * #sell form below.
 */
export async function PackagesSection({ packages }: { packages: PublicPlacementPackage[] }) {
  if (packages.length === 0) return null;
  const t = await getTranslations('home.packages');
  const tChannel = await getTranslations('placementChannels');

  return (
    <section id="packages" className="home-container home-section home-packages">
      <HomeSectionHeading title={t('title')} />
      <p className="home-packages-subtitle">{t('subtitle')}</p>
      <div className="home-packages-grid">
        {packages.map((pkg, idx) => (
          <ScrollReveal key={pkg.id} delay={Math.min(idx, 5) * 0.06} className="h-full">
            <article className={cn('home-package', pkg.isFeatured && 'home-package-featured')}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="home-item-title">{pkg.title}</h3>
                {pkg.isFeatured && <span className="home-package-badge">{t('featured')}</span>}
              </div>
              <p className="home-package-price">{formatMoney(pkg.priceUah, 'UAH')}</p>
              {pkg.description && (
                <p className="mt-3 text-body-md leading-[1.6] text-ink-2">{pkg.description}</p>
              )}
              {pkg.channels.length > 0 && (
                <ul className="home-package-channels">
                  {pkg.channels.map((channel) => (
                    <li key={channel}>{tChannel(channel)}</li>
                  ))}
                </ul>
              )}
              {pkg.features.length > 0 && (
                <ul className="home-package-features">
                  {/* Free text may repeat, so the position disambiguates the key. */}
                  {pkg.features.map((feature, featureIdx) => (
                    <li key={`${featureIdx}:${feature}`}>{feature}</li>
                  ))}
                </ul>
              )}
              <PackagePickLink
                packageId={pkg.id}
                label={t('pick')}
                ariaLabel={t('pickLabel', { title: pkg.title })}
              />
            </article>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
