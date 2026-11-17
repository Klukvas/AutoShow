import { describe, expect, it } from 'vitest';
import type { PublicListing } from '@/lib/api/types';
import { catalogResults } from './catalog-results';

const listing = (id: string) => ({ id }) as PublicListing;
const page = (items: PublicListing[], nextCursor: string | null) =>
  ({ ok: true, items, nextCursor, total: 40, newStartIndex: null }) as const;

describe('catalogResults', () => {
  it('turns a failed request into the error state with a retry link to the same URL', () => {
    expect(catalogResults({ ok: false }, true, { q: 'bmw', 'car[]': ['bmw', 'audi'] })).toEqual({
      status: 'error',
      retryHref: '/cars?q=bmw&car%5B%5D=bmw&car%5B%5D=audi',
    });
  });

  it('keeps an honest zero-result filter apart from the error state', () => {
    expect(catalogResults(page([], null), true, {})).toEqual({
      status: 'empty',
      continuation: null,
    });
  });

  it('offers "load more" while the fan-out budget allows another page', () => {
    const results = catalogResults(page([listing('a'), listing('b')], 'c2'), true, {});
    expect(results).toEqual({
      status: 'found',
      items: [listing('a'), listing('b')],
      newStartIndex: null,
      continuation: { kind: 'load-more', nextCursor: 'c2' },
    });
  });

  it('explains the cap instead of offering a button the budget cannot honour', () => {
    const results = catalogResults(page([listing('a'), listing('b')], 'c2'), false, {});
    expect(results).toMatchObject({ continuation: { kind: 'limit-reached', shownCount: 2 } });
  });

  it('shows neither on the last page', () => {
    expect(catalogResults(page([listing('a')], null), false, {})).toMatchObject({
      status: 'found',
      continuation: null,
    });
  });
});
