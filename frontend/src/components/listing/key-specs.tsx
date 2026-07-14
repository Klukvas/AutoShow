import { formatEngineVolume, formatMileage, formatPowerHp } from '@/lib/format';
import type { PublicListing } from '@/lib/api/types';

type Translate = (key: string) => string;

/**
 * Mobile key-spec boxes (handoff 1g): Пробіг / Двигун / Потужність in three
 * bordered tiles under the price.
 */
export function KeySpecs({ listing, t }: { listing: PublicListing; t: Translate }) {
  const specs = [
    { label: t('specMileage'), value: formatMileage(listing.mileageKm) },
    {
      label: t('specEngine'),
      value: listing.engineVolumeL ? formatEngineVolume(listing.engineVolumeL) : null,
    },
    {
      label: t('specPowerShort'),
      value: listing.powerHp ? formatPowerHp(listing.powerHp) : null,
    },
  ].filter((s) => s.value);

  if (specs.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {specs.map((spec) => (
        <div key={spec.label} className="rounded-input border border-line bg-surface px-3 py-2.5">
          <div className="truncate text-label font-semibold uppercase text-ink-3">{spec.label}</div>
          <div className="tabular mt-0.5 truncate font-heading text-[15px] font-bold text-ink">
            {spec.value}
          </div>
        </div>
      ))}
    </div>
  );
}
