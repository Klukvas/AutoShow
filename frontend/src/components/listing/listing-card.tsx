import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FavoriteButton } from './favorite-button';
import { CompareButton } from './compare-button';
import { MediaPicture } from '@/components/ui/media-picture';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { formatMoney, formatMileage, formatYear } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

interface ListingCardProps {
  listing: PublicListing;
  priority?: boolean;
  sizes?: string;
  baseCurrency?: Currency;
  /** Homepage keeps its approved, minimal caption; catalogue exposes deal metadata. */
  variant?: 'default' | 'cinematic';
}

export function ListingCard({
  listing,
  priority,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  baseCurrency,
  variant = 'default',
}: ListingCardProps) {
  const t = useTranslations('catalog');
  const tl = useTranslations('listing');
  const cover = listing.media.find((media) => media.type === 'image' && media.isCover)
    ?? listing.media.find((media) => media.type === 'image');
  const price = formatMoney(
    baseCurrency ? listing.price.normalized : listing.price.amount,
    baseCurrency ?? listing.price.currency,
  );
  const isNew = listing.publishedAt !== null && Date.now() - Date.parse(listing.publishedAt) < 7 * 24 * 60 * 60 * 1000;
  const hasVideo = listing.media.some((media) => media.type === 'video');
  const photos = listing.media.filter((media) => media.type === 'image').length;
  return (
    <article className="home-listing-card">
      <div className="home-listing-photo">
        <Link
          href={`/cars/${listing.slug}`}
          className="home-listing-photo-link focus-ring"
          aria-label={listing.title}
        >
          {cover ? (
            <MediaPicture media={cover} alt={listing.title} fill sizes={sizes} priority={priority} />
          ) : (
            <MediaPlaceholder ariaLabel={listing.title} className="absolute inset-0" />
          )}
        </Link>
        {cover?.aiEdited && <span className="pointer-events-none absolute bottom-3 left-3 bg-black/75 px-2 py-1 text-xs text-white">{tl(cover.sceneAltered ? 'sceneAltered' : 'aiEdited')}</span>}
        <div className="home-listing-tools">
          <FavoriteButton slug={listing.slug} />
          <CompareButton slug={listing.slug} />
        </div>
        {listing.status !== 'published' && (
          <span className="home-listing-status">
            {tl(listing.status === 'reserved' ? 'statusReserved' : 'statusSold')}
          </span>
        )}
      </div>
      <Link href={`/cars/${listing.slug}`} className="home-listing-caption focus-ring">
        <h3>{listing.title} · {formatYear(listing.year)}</h3>
        <div className="home-listing-price">
          {price} <span aria-hidden>⟶</span>
          {variant === 'default' && listing.price.priceDrop && (
            <small className="platform-price-drop" title={t('priceDropped')}>
              ↓{listing.price.priceDrop.dropPct}%
            </small>
          )}
        </div>
        <p>{formatMileage(listing.mileageKm)} · {listing.location.city}</p>
        {variant === 'default' && (
          <>
            <ul className="platform-card-tags">
              <li>{t(`condition.${listing.condition}`)}</li>
              {isNew && <li>{t('badgeNew')}</li>}
              {hasVideo && <li aria-label="Video">▶</li>}
              {listing.tags.map((tag) => <li key={tag.slug}>{tag.nameUk}</li>)}
              {photos > 0 && <li>{t('photoCount', { count: photos })}</li>}
            </ul>
          </>
        )}
      </Link>
    </article>
  );
}
