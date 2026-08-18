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
 * Editorial "Paper Lot" masthead: a ruled top line (kicker · edition mark),
 * an oversized headline + CTAs, and the freshest listing as a large framed
 * plate with a ruled caption. Static RSC — the hero is the LCP, no client
 * motion here.
 */
export function HomeHero({ listing, title, subtitle }: HomeHeroProps) {
  const t = useTranslations('home');
  const cover = listing?.media.find((m) => m.isCover) ?? listing?.media[0];
  const full =
    cover?.renditions.find((r) => r.variant === 'full' && r.format === 'jpeg') ??
    cover?.renditions[0];
  const edition = `’${String(new Date().getFullYear()).slice(-2)}`;

  return (
    <section className="border-b border-line bg-surface-warm">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        {/* Masthead rule — kicker left, edition mark right */}
        <div className="flex items-center justify-between border-b border-line py-3 font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-ink-2">
          <span>{t('heroEyebrow')}</span>
          <span aria-hidden className="text-lot-gold">
            {edition}
          </span>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="max-w-xl font-heading text-hero font-extrabold leading-[1.04] tracking-editorial text-ink md:text-editorial md:font-black">
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
              <div className="plate-photo relative h-[240px] md:h-[340px]">
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
              <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3">
                <span className="truncate text-card-title font-bold text-ink group-hover:text-lot-gold">
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
      </div>
    </section>
  );
}
