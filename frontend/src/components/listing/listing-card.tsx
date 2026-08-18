import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FavoriteButton } from '@/components/listing/favorite-button';
import { CompareButton } from '@/components/listing/compare-button';
import { MediaPicture } from '@/components/ui/media-picture';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { formatMoney, formatMileage, formatYear } from '@/lib/format';
import type { Currency, PublicListing } from '@/lib/api/types';

const NEW_ARRIVAL_DAYS = 7;

function isNewArrival(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  return Date.now() - Date.parse(publishedAt) < NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Decorative "lot" ornament for the Paper Lot card — a stable 3-digit number
 * derived from the listing id so it never shifts between renders. It is NOT a
 * real inventory/stock reference (hence aria-hidden); wire one in later if the
 * showroom wants a true catalogue number.
 */
function lotNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String((h % 900) + 100);
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
 * Grid card — "Paper Lot" direction: a warm editorial / auction-catalogue
 * treatment. Ruled top bar (condition eyebrow · lot no.), a matte-mounted
 * photo, a ruled spec strip (year / mileage / city) and the price as the hero
 * numeral. Palette is warm paper in light, walnut in dark (--lot-* tokens);
 * the stamp red replaces the brand accent as the card's own accent. Hover
 * presses the card up 1px and tints the frame gold (suppressed for
 * reduced-motion users).
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
      className="group focus-ring block overflow-hidden rounded-[6px] border border-line bg-surface text-ink shadow-[0_10px_24px_-20px_rgb(var(--shadow)/0.55)] transition-[transform,box-shadow,border-color] duration-200 motion-safe:hover:-translate-y-px hover:border-lot-gold hover:shadow-[0_16px_30px_-20px_rgb(var(--shadow)/0.7)]"
    >
      {/* Ruled top bar — condition eyebrow · lot ornament */}
      <div className="flex items-center justify-between border-b border-line px-3.5 pb-2 pt-3">
        <span className="text-[0.625rem] font-extrabold uppercase tracking-[0.2em] text-ink-2">
          {t(`condition.${listing.condition}`)}
        </span>
        <span
          aria-hidden
          className="font-mono text-[0.625rem] font-bold tracking-[0.12em] text-lot-gold"
        >
          LOT {lotNumber(listing.id)}
        </span>
      </div>

      {/* Matte-mounted photo */}
      <div className="plate-photo relative mx-3 mt-3 h-[158px] overflow-hidden rounded-[3px] ring-1 ring-inset ring-line">
        {cover ? (
          <MediaPicture media={cover} alt={display} fill sizes={sizes} priority={priority} />
        ) : (
          <MediaPlaceholder ariaLabel={display} wordmark="AUTOFLOW" className="absolute inset-0" />
        )}
        {fresh && (
          <span className="absolute left-2 top-2 -rotate-2 rounded-[2px] bg-accent px-2 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-[0.16em] text-surface shadow-[0_4px_10px_-5px_rgb(var(--accent)/0.7)]">
            {t('badgeNew')}
          </span>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <FavoriteButton slug={listing.slug} />
          <CompareButton slug={listing.slug} />
        </div>
        {listing.status === 'reserved' && (
          <span className="absolute bottom-2 left-2 rounded-[2px] bg-ink/85 px-2 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-[0.14em] text-surface backdrop-blur-sm">
            {tl('statusReserved')}
          </span>
        )}
        {(photoCount > 0 || hasVideo) && (
          <span
            aria-label={t('photoCount', { count: photoCount })}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[2px] bg-ink/70 px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tracking-wide text-surface backdrop-blur-sm"
          >
            {hasVideo && <VideoIcon />}
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <CameraIcon />
                {photoCount}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3.5 pb-4 pt-3.5">
        <h3 className="font-heading text-[1.125rem] font-extrabold leading-[1.12] tracking-editorial text-ink transition-colors group-hover:text-lot-gold">
          {display}
        </h3>

        {/* Ruled spec strip */}
        <div className="mt-2.5 flex items-center gap-2 border-y border-line py-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-2">
          <span>{formatYear(listing.year)}</span>
          <span aria-hidden className="text-line">
            /
          </span>
          <span>{formatMileage(listing.mileageKm)}</span>
          <span aria-hidden className="text-line">
            /
          </span>
          <span className="min-w-0 truncate">{listing.location.city}</span>
        </div>

        {/* Price — hero numeral. The label + drop share a micro-row above so
            the numeral keeps the full card width even for 7-digit prices. */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-[0.2em] text-ink-2">
              {t('priceLabel')}
            </span>
            {listing.price.priceDrop && (
              <span
                className="text-[0.625rem] font-extrabold tracking-wide text-accent"
                title={t('priceDropped')}
                aria-label={t('priceDropped')}
              >
                ↓{listing.price.priceDrop.dropPct}%
              </span>
            )}
          </div>
          <span className="mt-0.5 block tabular font-heading text-price-lg font-black leading-none tracking-tight text-ink">
            {price}
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

function VideoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden
      className="h-3 w-3"
    >
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  );
}
