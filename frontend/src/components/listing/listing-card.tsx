import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FavoriteButton } from '@/components/listing/favorite-button';
import { MediaPicture } from '@/components/ui/media-picture';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { ConditionBadge, StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatMileage, formatYear } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

const NEW_ARRIVAL_DAYS = 7;

function isNewArrival(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  return Date.now() - Date.parse(publishedAt) < NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
}

interface ListingCardProps {
  listing: PublicListing;
  priority?: boolean;
  sizes?: string;
  /** Site base currency — when set, the card shows the normalized price so the
   *  displayed amount matches the price filter/sort unit. */
  baseCurrency?: Currency;
}

/**
 * Grid card per handoff 1a: white surface, 14px radius, photo block on top
 * with a condition badge, then title → year·mileage → price+city. Hover lifts
 * the card 3px under a soft shadow (suppressed for reduced-motion users).
 */
export function ListingCard({
  listing,
  priority,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  baseCurrency,
}: ListingCardProps) {
  const t = useTranslations('catalog');
  const tl = useTranslations('listing');
  const cover = listing.media.find((m) => m.isCover) ?? listing.media[0];
  const display = `${listing.make.nameUk} ${listing.model.nameUk}`;
  const price = baseCurrency
    ? formatMoney(listing.price.normalized, baseCurrency)
    : formatMoney(listing.price.amount, listing.price.currency);
  const photoCount = listing.media.filter((m) => m.type === 'image').length;
  const hasVideo = listing.media.some((m) => m.type === 'video');
  const fresh = isNewArrival(listing.publishedAt);

  return (
    <Link
      href={`/cars/${listing.slug}`}
      className="group focus-ring block overflow-hidden rounded-card border border-line bg-surface transition-[transform,box-shadow,border-color] duration-200 motion-safe:hover:-translate-y-[3px] hover:border-line-hover hover:shadow-card"
    >
      <div className="relative h-[172px] overflow-hidden sm:h-[158px]">
        {cover ? (
          <MediaPicture media={cover} alt={display} fill sizes={sizes} priority={priority} />
        ) : (
          <MediaPlaceholder ariaLabel={display} wordmark="AUTOFLOW" className="absolute inset-0" />
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <ConditionBadge condition={listing.condition}>
            {t(`condition.${listing.condition}`)}
          </ConditionBadge>
          {fresh && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">
              {t('badgeNew')}
            </span>
          )}
        </div>
        <FavoriteButton slug={listing.slug} className="absolute right-2.5 top-2.5" />
        {listing.status === 'reserved' && (
          <StatusBadge status="reserved" className="absolute bottom-3 left-3 backdrop-blur-sm">
            {tl('statusReserved')}
          </StatusBadge>
        )}
        {(photoCount > 0 || hasVideo) && (
          <span
            aria-label={t('photoCount', { count: photoCount })}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm"
          >
            {hasVideo && <span aria-hidden>🎬</span>}
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <CameraIcon />
                {photoCount}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-card-title font-bold text-ink group-hover:text-accent-hover dark:group-hover:text-accent">
          {display}
        </h3>
        <p className="mt-0.5 text-sub text-ink-3">
          {formatYear(listing.year)} · {formatMileage(listing.mileageKm)}
        </p>
        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-1.5">
            <span className="tabular font-heading text-price-sm font-extrabold text-ink">
              {price}
            </span>
            {listing.price.priceDrop && (
              <span
                className="inline-flex items-center rounded-full bg-ok/10 px-1.5 py-0.5 text-[11px] font-bold text-ok"
                title={t('priceDropped')}
                aria-label={t('priceDropped')}
              >
                ↓{listing.price.priceDrop.dropPct}%
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-sub text-ink-2">
            <span aria-hidden>📍</span>
            {listing.location.city}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className="h-3 w-3"
    >
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
