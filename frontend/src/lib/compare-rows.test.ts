import { describe, it, expect } from 'vitest';
import {
  COMPARE_ROWS,
  bestIndexes,
  buildRowView,
  compareLeadSummary,
  isUniform,
} from './compare-rows';
import type { PublicListing } from './api/types';

const row = (key: string) => {
  const found = COMPARE_ROWS.find((r) => r.key === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

function car(overrides: {
  slug?: string;
  year?: number;
  mileageKm?: number;
  powerHp?: number;
  ownersCount?: number;
  normalized?: string;
  currency?: 'USD' | 'EUR' | 'UAH';
}): PublicListing {
  return {
    slug: overrides.slug ?? 'car',
    year: overrides.year ?? 2020,
    mileageKm: overrides.mileageKm ?? 50_000,
    powerHp: overrides.powerHp ?? 200,
    ownersCount: overrides.ownersCount ?? 1,
    make: { nameUk: 'BMW' },
    model: { nameUk: 'X5' },
    price: {
      amount: overrides.normalized ?? '30000',
      currency: overrides.currency ?? 'USD',
      normalized: overrides.normalized ?? '30000',
    },
  } as unknown as PublicListing;
}

describe('bestIndexes', () => {
  it('picks the cheapest car by normalized price', () => {
    const items = [car({ normalized: '30000' }), car({ normalized: '25000' })];
    expect(bestIndexes(row('price'), items)).toEqual([1]);
  });

  it('compares normalized price even when display currencies differ', () => {
    const items = [
      car({ normalized: '20000', currency: 'EUR' }),
      car({ normalized: '21000', currency: 'USD' }),
    ];
    expect(bestIndexes(row('price'), items)).toEqual([0]);
  });

  it('prefers the newer year and the lower mileage', () => {
    const items = [car({ year: 2018, mileageKm: 90_000 }), car({ year: 2021, mileageKm: 40_000 })];
    expect(bestIndexes(row('year'), items)).toEqual([1]);
    expect(bestIndexes(row('mileage'), items)).toEqual([1]);
  });

  it('shares the win on a tie but not when every car is equal', () => {
    const tie = [car({ year: 2021 }), car({ year: 2021 }), car({ year: 2019 })];
    expect(bestIndexes(row('year'), tie)).toEqual([0, 1]);
    expect(bestIndexes(row('year'), [car({}), car({})])).toEqual([]);
  });

  it('has no winner for unranked rows or a single car', () => {
    expect(bestIndexes(row('city'), [car({}), car({ year: 2001 })])).toEqual([]);
    expect(bestIndexes(row('year'), [car({})])).toEqual([]);
  });

  it('skips a row with a non-numeric value instead of guessing', () => {
    const items = [car({ normalized: 'oops' }), car({ normalized: '1000' })];
    expect(bestIndexes(row('price'), items)).toEqual([]);
  });
});

describe('buildRowView', () => {
  it('prefers more power and fewer owners', () => {
    const items = [car({ powerHp: 190, ownersCount: 1 }), car({ powerHp: 250, ownersCount: 3 })];
    expect(buildRowView(row('power'), items).best).toEqual([1]);
    expect(buildRowView(row('owners'), items).best).toEqual([0]);
  });

  it('treats values that render the same as equal — no ✓, row is uniform', () => {
    const view = buildRowView(row('mileage'), [
      car({ mileageKm: 40_400 }),
      car({ mileageKm: 40_499 }),
    ]);
    expect(view.uniform).toBe(true);
    expect(view.best).toEqual([]);
  });
});

describe('isUniform', () => {
  it('is true only when every value matches', () => {
    expect(isUniform(['a', 'a'])).toBe(true);
    expect(isUniform(['a', 'b'])).toBe(false);
  });
});

describe('compareLeadSummary', () => {
  it('lists each car with a link under the heading', () => {
    const text = compareLeadSummary(
      [car({ slug: 'bmw-x5', year: 2020 })],
      'https://autos-sale.com',
      'Порівняння:',
    );
    expect(text).toBe('Порівняння:\n• BMW X5 2020 — https://autos-sale.com/cars/bmw-x5');
  });

  it('keeps the compare order, one line per car', () => {
    const text = compareLeadSummary(
      [car({ slug: 'a' }), car({ slug: 'b' }), car({ slug: 'c' })],
      'https://x.test',
      'H',
    );
    expect(text.split('\n').map((line) => line.slice(-1))).toEqual(['H', 'a', 'b', 'c']);
  });
});
