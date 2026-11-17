import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import type { PublicListing } from '@/lib/api/types';

const getListingBySlug = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/public', () => ({ publicApi: { getListingBySlug } }));

import {
  NO_SAVED_LISTINGS,
  failedLoadOutcome,
  fetchSavedListing,
  loadSavedListings,
  pruneGoneListings,
  summarizeSavedListings,
} from './saved-listings';

const car = (slug: string) => ({ id: `id-${slug}`, slug }) as unknown as PublicListing;
const apiError = (status: number) =>
  new ApiClientError(status, { statusCode: status, error: 'Error', message: 'fixture' });

/** The fixture backend: `gone*` cars are deleted, `broken` fails, every other slug is a car. */
function answerBySlug(slug: string): Promise<PublicListing> {
  if (slug.startsWith('gone')) return Promise.reject(apiError(404));
  if (slug === 'broken') return Promise.reject(apiError(500));
  return Promise.resolve(car(slug));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('failedLoadOutcome', () => {
  it('treats only a 404 as a deleted car', () => {
    expect(failedLoadOutcome('a', apiError(404))).toEqual({ kind: 'gone', slug: 'a' });
  });

  it.each([
    ['a server error', apiError(500)],
    ['a rate limit', apiError(429)],
    ['an offline tab', new TypeError('Failed to fetch')],
    ['a non-error rejection', 'timeout'],
    ['a 404 that is not an API error', { status: 404 }],
  ])('keeps the saved slug on %s', (_name, error) => {
    expect(failedLoadOutcome('a', error)).toEqual({ kind: 'failed' });
  });
});

describe('fetchSavedListing', () => {
  it('loads the car uncached so its price and status are current', async () => {
    getListingBySlug.mockResolvedValueOnce(car('a'));
    await expect(fetchSavedListing('a')).resolves.toEqual({ kind: 'loaded', listing: car('a') });
    expect(getListingBySlug.mock.calls).toEqual([['a', { revalidate: 0 }]]);
  });

  it('resolves instead of rejecting, so one bad car cannot fail the whole batch', async () => {
    getListingBySlug.mockRejectedValueOnce(apiError(404)).mockRejectedValueOnce(apiError(500));
    await expect(fetchSavedListing('deleted')).resolves.toEqual({ kind: 'gone', slug: 'deleted' });
    await expect(fetchSavedListing('broken')).resolves.toEqual({ kind: 'failed' });
  });
});

describe('summarizeSavedListings', () => {
  it('keeps the loaded cars in saved order and collects the deleted slugs', () => {
    expect(
      summarizeSavedListings([
        { kind: 'loaded', listing: car('a') },
        { kind: 'gone', slug: 'b' },
        { kind: 'loaded', listing: car('c') },
        { kind: 'gone', slug: 'd' },
      ]),
    ).toEqual({ listings: [car('a'), car('c')], goneSlugs: ['b', 'd'], hasFailure: false });
  });

  it('never prunes a car whose load merely failed', () => {
    expect(
      summarizeSavedListings([{ kind: 'failed' }, { kind: 'loaded', listing: car('a') }]),
    ).toEqual({ listings: [car('a')], goneSlugs: [], hasFailure: true });
  });

  it('is the empty result for no saved cars', () => {
    expect(summarizeSavedListings([])).toEqual(NO_SAVED_LISTINGS);
  });
});

describe('loadSavedListings', () => {
  it('asks for every saved car once, uncached, in saved order', async () => {
    getListingBySlug.mockImplementation(answerBySlug);
    await loadSavedListings(['c', 'a', 'b']);
    expect(getListingBySlug.mock.calls).toEqual([
      ['c', { revalidate: 0 }],
      ['a', { revalidate: 0 }],
      ['b', { revalidate: 0 }],
    ]);
  });

  it('issues all requests at once, not one after another', () => {
    getListingBySlug.mockReturnValue(new Promise(() => undefined));
    void loadSavedListings(['a', 'b', 'c']);
    expect(getListingBySlug).toHaveBeenCalledTimes(3);
  });

  it('issues no request when nothing is saved', async () => {
    await expect(loadSavedListings([])).resolves.toEqual(NO_SAVED_LISTINGS);
    expect(getListingBySlug).not.toHaveBeenCalled();
  });

  it('shows the cars that loaded, marks only the deleted one and reports the failure', async () => {
    getListingBySlug.mockImplementation(answerBySlug);
    await expect(loadSavedListings(['a', 'gone', 'broken', 'd'])).resolves.toEqual({
      listings: [car('a'), car('d')],
      goneSlugs: ['gone'],
      hasFailure: true,
    });
  });
});

describe('pruneGoneListings', () => {
  it('removes exactly the deleted cars, in one update', async () => {
    getListingBySlug.mockImplementation(answerBySlug);
    const removeMany = vi.fn();
    pruneGoneListings(await loadSavedListings(['a', 'gone', 'broken', 'gone-too']), removeMany);
    expect(removeMany.mock.calls).toEqual([[['gone', 'gone-too']]]);
  });

  it('writes nothing to storage when no car was deleted', async () => {
    getListingBySlug.mockImplementation(answerBySlug);
    const removeMany = vi.fn();
    pruneGoneListings(await loadSavedListings(['a', 'broken']), removeMany);
    pruneGoneListings(NO_SAVED_LISTINGS, removeMany);
    expect(removeMany).not.toHaveBeenCalled();
  });
});
