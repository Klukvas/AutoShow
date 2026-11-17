import { describe, expect, it, vi } from 'vitest';
import type { PublicListing } from '@/lib/api/types';
import { COMPARE_ROWS } from '@/lib/compare-rows';
import { compareState } from './compare-state';

function car(slug: string, overrides: { year?: number; normalized?: string } = {}): PublicListing {
  return {
    id: `id-${slug}`,
    slug,
    year: overrides.year ?? 2020,
    mileageKm: 50_000,
    powerHp: 200,
    ownersCount: 1,
    engineVolumeL: '2.0',
    make: { nameUk: 'BMW' },
    model: { nameUk: 'X5' },
    location: { city: 'Київ' },
    price: {
      amount: overrides.normalized ?? '30000',
      currency: 'USD',
      normalized: overrides.normalized ?? '30000',
    },
  } as unknown as PublicListing;
}

const lead = () => ({ siteOrigin: 'https://dealer.example', heading: 'Порівняння:' });
const loaded = {
  baseCurrency: 'USD' as const,
  hasLoadFailure: false,
  isLoading: false,
  isShowingOnlyDifferences: false,
  lead,
};
const rowKeys = (state: ReturnType<typeof compareState>) =>
  state.status === 'ready' ? state.comparison.rows.map((view) => view.row.key) : null;

describe('compareState', () => {
  it('is loading until the first load finishes and does not read the browser origin', () => {
    const unusedLead = vi.fn(lead);
    expect(compareState({ ...loaded, cars: null, isLoading: true, lead: unusedLead })).toEqual({
      status: 'loading',
      rowCount: COMPARE_ROWS.length,
    });
    expect(compareState({ ...loaded, cars: [], lead: unusedLead })).toEqual({ status: 'empty' });
    expect(unusedLead).not.toHaveBeenCalled();
  });

  it('is an error without a table when no car could be loaded', () => {
    expect(compareState({ ...loaded, cars: [], hasLoadFailure: true, isLoading: true })).toEqual({
      status: 'error',
      comparison: null,
      isRetrying: true,
    });
  });

  it('keeps the cars that did load beside the error', () => {
    const state = compareState({ ...loaded, cars: [car('a')], hasLoadFailure: true });
    expect(state).toMatchObject({ status: 'error', isRetrying: false });
    expect(state.status === 'error' && state.comparison?.cars).toEqual([car('a')]);
  });

  it('compares every spec and summarises the cars for the lead', () => {
    const cars = [car('a', { year: 2019 }), car('b', { year: 2021 })];
    const state = compareState({ ...loaded, cars });
    expect(rowKeys(state)).toEqual(COMPARE_ROWS.map((row) => row.key));
    expect(state).toMatchObject({
      status: 'ready',
      comparison: {
        cars,
        canShowOnlyDifferences: true,
        isShowingOnlyDifferences: false,
        leadSummary:
          'Порівняння:\n• BMW X5 2019 — https://dealer.example/cars/a\n• BMW X5 2021 — https://dealer.example/cars/b',
      },
    });
  });

  it('shows only the specs that differ when asked to', () => {
    const cars = [car('a', { year: 2019, normalized: '25000' }), car('b', { year: 2021 })];
    expect(rowKeys(compareState({ ...loaded, cars, isShowingOnlyDifferences: true }))).toEqual([
      'price',
      'year',
    ]);
  });

  it('shows no rows for identical cars under "only differences"', () => {
    const cars = [car('a'), car('b')];
    expect(rowKeys(compareState({ ...loaded, cars, isShowingOnlyDifferences: true }))).toEqual([]);
  });

  it('does not blank the table of a single car when a stale "only differences" is still on', () => {
    const state = compareState({ ...loaded, cars: [car('a')], isShowingOnlyDifferences: true });
    expect(rowKeys(state)).toEqual(COMPARE_ROWS.map((row) => row.key));
    expect(state.status === 'ready' && state.comparison.canShowOnlyDifferences).toBe(false);
  });
});
