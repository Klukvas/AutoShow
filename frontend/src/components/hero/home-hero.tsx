import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { formatMoney } from '@/lib/format';
import type { PublicListing } from '@/lib/api/types';

interface HomeHeroProps {
  listing: PublicListing | null;
  title: string;
  subtitle: string;
}

/**
 * Editorial home hero on the warm surface (handoff 1f tone): kicker, oversized
 * headline, CTA — with the freshest listing as a large framed photo. Static
 * RSC: the hero is the LCP, so no client motion here.
 */
export function HomeHero({ listing, title, subtitle }: HomeHeroProps) {
  const t = useTranslations('home');
  const cover = listing?.media.find((m) => m.isCover) ?? listing?.media[0];
  const full =
    cover?.renditions.find((r) => r.variant === 'full' && r.format === 'jpeg') ??
    cover?.renditions[0];

  return (
    <section className="border-b border-line bg-surface-warm">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-5 py-12 md:grid-cols-2 md:px-8 md:py-16">
        <div>
          <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t('heroEyebrow')}
          </p>
          <h1 className="mt-4 max-w-xl font-heading text-hero font-extrabold text-ink md:text-editorial md:font-black">
            {title}
          </h1>
          <p className="mt-4 max-w-md text-body-md text-ink-2">{subtitle}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button as="link" href="/cars" variant="primary" size="lg">
              {t('heroCta')}
            </Button>
            <Button as="link" href="/contacts#lead" variant="ghost" size="lg">
              {t('heroSecondaryCta')}
            </Button>
          </div>
        </div>

        {listing ? (
          <Link
            href={`/cars/${listing.slug}`}
            className="group focus-ring block overflow-hidden rounded-hero border border-line bg-surface transition-[transform,box-shadow] duration-200 motion-safe:hover:-translate-y-[3px] hover:shadow-card"
          >
            <div className="relative h-[240px] md:h-[340px]">
              {full ? (
                <Image
                  src={full.url}
                  alt={cover?.alt ?? listing.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority
                  className="object-cover"
                />
              ) : (
                <MediaPlaceholder ariaLabel={listing.title} wordmark="AUTOFLOW" />
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-4 py-3.5">
              <span className="truncate text-card-title font-bold text-ink group-hover:text-accent-hover dark:group-hover:text-accent">
                {listing.title}
              </span>
              <span className="tabular shrink-0 font-heading text-price-sm font-extrabold text-ink">
                {formatMoney(listing.price.amount, listing.price.currency)}
              </span>
            </div>
          </Link>
        ) : (
          <div className="relative h-[240px] overflow-hidden rounded-hero border border-line md:h-[340px]">
            <MediaPlaceholder wordmark="AUTOFLOW" />
          </div>
        )}
      </div>
    </section>
  );
}
