import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LeadCtaButton } from '@/components/lead/lead-cta';
import { formatMoney } from '@/lib/format';
import { formatPriceNote } from '@/lib/listing-price';
import { hoursLines } from '@/lib/working-hours';
import type { Branding, PublicListing } from '@/lib/api/types';

interface ContactPanelProps {
  listing: PublicListing;
  branding: Branding | null;
}

/**
 * Sticky contact panel per handoff 1d: oversized price, "≈ ₴ · торг доречний"
 * note, three CTAs (call / lead / test drive), trust list built from real
 * listing fields, phone + working hours.
 */
export function ContactPanel({ listing, branding }: ContactPanelProps) {
  const t = useTranslations('listing');
  const price = formatMoney(listing.price.amount, listing.price.currency);
  const priceNote = formatPriceNote(listing.price, branding?.defaultCurrency, t('negotiable'));

  // Client (consignment) car → the owner's contacts; own car → the showroom's.
  const isClientCar = listing.seller.type === 'client' && Boolean(listing.seller.phone);
  const phone = isClientCar ? listing.seller.phone : branding?.contactPhone;
  const phoneHref = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  const sellerLine = isClientCar
    ? t('sellerPrivate', { name: listing.seller.name ?? t('sellerPrivateFallback') })
    : t('sellerDealer', { name: branding?.displayName ?? 'AutoFlow' });

  const trust = [
    listing.customsCleared ? t('trustCustoms') : null,
    listing.ownersCount === 1 ? t('trustOneOwner') : null,
    !listing.isCrashed ? t('trustNoAccidents') : null,
  ].filter((item): item is string => item != null);

  const hours = hoursLines(branding?.workingHours);

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-panel">
      <div className="tabular font-heading text-price-lg font-extrabold text-ink">{price}</div>
      {priceNote && <p className="mt-1 text-sub text-ink-2">{priceNote}</p>}
      <p className="mt-2 text-sub font-semibold text-ink-2">{sellerLine}</p>

      <div className="mt-5 space-y-2.5">
        {phoneHref && (
          <Button as="a" href={phoneHref} variant="primary" size="lg" className="w-full">
            <span aria-hidden>📞</span>
            {t('callCta')}
          </Button>
        )}
        {/* Sold car takes no inquiries — the lead CTAs would scroll to a form
            that is no longer rendered. */}
        {listing.status !== 'sold' && (
          <>
            <LeadCtaButton type="callback" variant="outline" className="w-full">
              {t('messageCta')}
            </LeadCtaButton>
            <LeadCtaButton type="test_drive" variant="ghost" className="w-full">
              {t('testDriveCta')}
            </LeadCtaButton>
          </>
        )}
      </div>

      {trust.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-line pt-5">
          {trust.map((item) => (
            <li key={item} className="flex items-center gap-2 text-body-md text-ink-2">
              <span aria-hidden className="text-ok">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {(phone || hours.length > 0) && (
        <div className="mt-5 border-t border-line pt-5">
          {phone && phoneHref && (
            <a
              href={phoneHref}
              className="focus-ring tabular font-heading text-[17px] font-bold text-ink transition-colors hover:text-accent-hover dark:hover:text-accent"
            >
              {phone}
            </a>
          )}
          {/* Working hours are the showroom's — irrelevant next to a private
              owner's phone number. */}
          {!isClientCar &&
            hours.map((line) => (
              <p key={line} className="tabular mt-1 text-sub text-ink-3">
                {line}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
