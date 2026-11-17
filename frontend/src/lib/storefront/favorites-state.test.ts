import { describe, expect, it } from 'vitest';
import type { PublicListing } from '@/lib/api/types';
import { favoritesState } from './favorites-state';

const car = (slug: string) => ({ id: `id-${slug}`, slug }) as unknown as PublicListing;
const loaded = { hasLoadFailure: false, isLoading: false, savedCount: 2 };

describe('favoritesState', () => {
  it('is loading until the first load finishes and reports the real saved count', () => {
    expect(favoritesState({ ...loaded, listings: null, isLoading: true, savedCount: 40 })).toEqual({
      status: 'loading',
      savedCount: 40,
    });
    expect(favoritesState({ ...loaded, listings: null, savedCount: 0 })).toEqual({
      status: 'loading',
      savedCount: 0,
    });
  });

  it('is ready with the loaded cars', () => {
    const listings = [car('a'), car('b')];
    expect(favoritesState({ ...loaded, listings })).toEqual({ status: 'ready', listings });
  });

  it('is empty only when nothing is saved and nothing failed', () => {
    expect(favoritesState({ ...loaded, listings: [] })).toEqual({ status: 'empty' });
  });

  it('is an error, not empty, when no car could be loaded', () => {
    expect(favoritesState({ ...loaded, listings: [], hasLoadFailure: true })).toEqual({
      status: 'error',
      listings: [],
      isRetrying: false,
    });
  });

  it('keeps the cars that did load beside the error and reports a running retry', () => {
    const listings = [car('a')];
    expect(favoritesState({ ...loaded, listings, hasLoadFailure: true, isLoading: true })).toEqual({
      status: 'error',
      listings,
      isRetrying: true,
    });
  });

  it('keeps showing the cars while they are un-hearted (the saved count is not the grid)', () => {
    const listings = [car('a'), car('b')];
    expect(favoritesState({ ...loaded, listings, savedCount: 0 })).toEqual({
      status: 'ready',
      listings,
    });
  });
});
