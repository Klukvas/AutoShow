import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MediaPicture } from '@/components/ui/media-picture';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { ConditionBadge, StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatMileage, formatYear } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

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
        <ConditionBadge condition={listing.condition} className="absolute left-3 top-3">
          {t(`condition.${listing.condition}`)}
        </ConditionBadge>
        {listing.status === 'reserved' && (
          <StatusBadge status="reserved" className="absolute right-3 top-3 backdrop-blur-sm">
            {tl('statusReserved')}
          </StatusBadge>
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
          <span className="tabular font-heading text-price-sm font-extrabold text-ink">
            {price}
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
