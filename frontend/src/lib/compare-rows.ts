import {
  formatEngineVolume,
  formatMileage,
  formatMoney,
  formatPowerHp,
  formatYear,
} from './format';
import type { Currency, PublicListing } from './api/types';

/** Which direction counts as "better" for a numeric spec. */
type Better = 'lower' | 'higher';

export interface CompareRow {
  key: string;
  value: (l: PublicListing, base?: Currency) => string;
  /** Rows with an objective winner (price, mileage…) mark the best car. */
  rank?: { metric: (l: PublicListing) => number; better: Better };
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    key: 'price',
    value: (l, base) =>
      base ? formatMoney(l.price.normalized, base) : formatMoney(l.price.amount, l.price.currency),
    // `normalized` is always in the base currency, so mixed-currency listings
    // still compare correctly even when the display falls back to originals.
    rank: { metric: (l) => Number(l.price.normalized), better: 'lower' },
  },
  {
    key: 'year',
    value: (l) => formatYear(l.year),
    rank: { metric: (l) => l.year, better: 'higher' },
  },
  {
    key: 'mileage',
    value: (l) => formatMileage(l.mileageKm),
    rank: { metric: (l) => l.mileageKm, better: 'lower' },
  },
  { key: 'engine', value: (l) => formatEngineVolume(l.engineVolumeL) },
  {
    key: 'power',
    value: (l) => formatPowerHp(l.powerHp),
    rank: { metric: (l) => l.powerHp, better: 'higher' },
  },
  { key: 'body', value: (l) => l.bodyType?.nameUk ?? '—' },
  { key: 'fuel', value: (l) => l.fuelType?.nameUk ?? '—' },
  { key: 'transmission', value: (l) => l.transmission?.nameUk ?? '—' },
  { key: 'drive', value: (l) => l.driveType?.nameUk ?? '—' },
  { key: 'color', value: (l) => l.color?.nameUk ?? '—' },
  {
    key: 'owners',
    value: (l) => String(l.ownersCount),
    rank: { metric: (l) => l.ownersCount, better: 'lower' },
  },
  { key: 'city', value: (l) => l.location.city },
];

export function isUniform(values: readonly string[]): boolean {
  return values.every((v) => v === values[0]);
}

/**
 * Indexes of the cars that win a ranked row. Ties share the win; a row where
 * every car is equal (or that has a non-finite value) has no winner — there
 * is nothing to highlight with a single car either.
 */
export function bestIndexes(row: CompareRow, items: readonly PublicListing[]): number[] {
  if (!row.rank || items.length < 2) return [];
  const { metric, better } = row.rank;
  const scores = items.map(metric);
  if (scores.some((s) => !Number.isFinite(s))) return [];
  const best = better === 'lower' ? Math.min(...scores) : Math.max(...scores);
  const winners = scores.flatMap((s, i) => (s === best ? [i] : []));
  return winners.length === items.length ? [] : winners;
}

export interface CompareRowView {
  row: CompareRow;
  values: string[];
  best: number[];
  uniform: boolean;
}

/**
 * Display values plus the "same everywhere" and "best" marks for one row.
 * Uniformity is judged on what the visitor sees: two raw values that round to
 * the same label (40 400 vs 40 499 km → "40 тис. км") are equal, so neither
 * gets a ✓ and the row hides under "only differences".
 */
export function buildRowView(
  row: CompareRow,
  items: readonly PublicListing[],
  base?: Currency,
): CompareRowView {
  const values = items.map((l) => row.value(l, base));
  const uniform = isUniform(values);
  return { row, values, uniform, best: uniform ? [] : bestIndexes(row, items) };
}

/** Plain-text summary of the compared cars for the lead message. */
export function compareLeadSummary(
  items: readonly PublicListing[],
  origin: string,
  heading: string,
): string {
  const lines = items.map(
    (l) => `• ${l.make.nameUk} ${l.model.nameUk} ${l.year} — ${origin}/cars/${l.slug}`,
  );
  return [heading, ...lines].join('\n');
}
