import { catalogLabel } from './catalog-label';
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
  value: (l: PublicListing, base?: Currency, locale?: string) => string;
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
    value: (l, _base, locale) => formatMileage(l.mileageKm, locale),
    rank: { metric: (l) => l.mileageKm, better: 'lower' },
  },
  { key: 'engine', value: (l, _base, locale) => formatEngineVolume(l.engineVolumeL, locale) },
  {
    key: 'power',
    value: (l, _base, locale) => formatPowerHp(l.powerHp, locale),
    rank: { metric: (l) => l.powerHp, better: 'higher' },
  },
  { key: 'body', value: (l, _base, locale) => catalogLabel(l.bodyType, locale) || '—' },
  { key: 'fuel', value: (l, _base, locale) => catalogLabel(l.fuelType, locale) || '—' },
  { key: 'transmission', value: (l, _base, locale) => catalogLabel(l.transmission, locale) || '—' },
  { key: 'drive', value: (l, _base, locale) => catalogLabel(l.driveType, locale) || '—' },
  { key: 'color', value: (l, _base, locale) => catalogLabel(l.color, locale) || '—' },
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
  locale?: string,
): CompareRowView {
  const values = items.map((l) => row.value(l, base, locale));
  const uniform = isUniform(values);
  return { row, values, uniform, best: uniform ? [] : bestIndexes(row, items) };
}

/** Plain-text summary of the compared cars for the lead message. */
export function compareLeadSummary(
  items: readonly PublicListing[],
  origin: string,
  heading: string,
  locale?: string,
): string {
  const lines = items.map(
    (l) =>
      `• ${catalogLabel(l.make, locale)} ${catalogLabel(l.model, locale)} ${l.year} — ${origin}/cars/${l.slug}`,
  );
  return [heading, ...lines].join('\n');
}
