import { formatEngineVolume, formatMileage, formatPowerHp, formatYear } from '@/lib/format';
import type { PublicListing } from '@/lib/api/types';

type Translate = (key: string) => string;

interface SpecTableProps {
  listing: PublicListing;
  t: Translate;
}

/**
 * "Характеристики" per handoff 1d: two columns of key/value rows separated by
 * hairlines. Null-ish specs are skipped so the grid never shows dashes.
 */
export function SpecTable({ listing, t }: SpecTableProps) {
  const engine = [
    listing.engineVolumeL ? formatEngineVolume(listing.engineVolumeL) : null,
    listing.fuelType?.nameUk?.toLowerCase() ?? null,
  ]
    .filter(Boolean)
    .join(', ');

  const rows: Array<{ term: string; value: string | null }> = [
    { term: t('specYear'), value: formatYear(listing.year) },
    { term: t('specMileage'), value: formatMileage(listing.mileageKm) },
    { term: t('specEngine'), value: engine || null },
    { term: t('specPower'), value: listing.powerHp ? formatPowerHp(listing.powerHp) : null },
    { term: t('specGearbox'), value: listing.transmission?.nameUk ?? null },
    { term: t('specDrive'), value: listing.driveType?.nameUk ?? null },
    { term: t('specBody'), value: listing.bodyType?.nameUk ?? null },
    { term: t('specColor'), value: listing.color?.nameUk ?? null },
    { term: t('specOwners'), value: String(listing.ownersCount) },
    { term: t('specVin'), value: listing.vin ?? null },
  ].filter((row) => row.value);

  return (
    <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.term}
          className="flex items-baseline justify-between gap-4 border-b border-line py-2.5"
        >
          <dt className="text-body-md text-ink-2">{row.term}</dt>
          <dd className="tabular text-right text-body-md font-semibold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
