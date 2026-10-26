import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

interface HomeHeroProps {
  listing: PublicListing | null;
  title: string;
  subtitle: string;
  baseCurrency?: Currency;
}

/** The current inventory supplies both the photograph and its truthful caption. */
export function HomeHero({ listing, title, subtitle, baseCurrency }: HomeHeroProps) {
  const t = useTranslations('home');
  const images = listing?.media.filter((media) => media.type === 'image') ?? [];
  const cover = images.find((media) => media.isCover) ?? images[0];
  const full = cover?.renditions.find((rendition) => rendition.variant === 'full' && rendition.format === 'jpeg') ?? cover?.renditions[0];
  const price = listing ? formatMoney(
    baseCurrency ? listing.price.normalized : listing.price.amount,
    baseCurrency ?? listing.price.currency,
  ) : null;

  return (
    <section className={`home-hero${full ? '' : ' home-hero-empty'}`}>
      {full && (
        <Image
          src={full.url}
          alt={cover?.alt ?? listing?.title ?? ''}
          fill
          sizes="100vw"
          priority
          className="home-hero-photo"
        />
      )}
      <div className="home-hero-shade" aria-hidden />
      <div className="home-hero-content home-container">
        <div className="home-hero-copy">
          <h1>{title}</h1>
          <p className="home-hero-subtitle">{subtitle}</p>
          <Link className="home-primary-cta focus-ring" href="/cars">
            {t('cinematicCta')} <span aria-hidden>↗</span>
          </Link>
        </div>
        <div className="home-hero-bottom">
          {listing ? (
            <Link href={`/cars/${listing.slug}`} className="home-featured-link focus-ring">
              <span>{listing.title} · {listing.year}</span>
              <span className="home-featured-price">{price} <span aria-hidden>⟶</span></span>
            </Link>
          ) : (
            <Link href="/contacts#lead" className="home-text-link focus-ring">
              {t('heroSecondaryCta')} <span aria-hidden>↗</span>
            </Link>
          )}
          <p className="home-kicker home-hero-note">{t('cinematicNote')}</p>
        </div>
      </div>
    </section>
  );
}
