import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api/client';
import type { PublicListing } from '@/lib/api/types';

const api = vi.hoisted(() => ({ getBranding: vi.fn(), getListingBySlug: vi.fn() }));
vi.mock('@/lib/api/public', () => ({ publicApi: api }));

import { loadComparedListings } from './compared-listings';

const car = (slug: string) => ({ id: `id-${slug}`, slug }) as unknown as PublicListing;
const serverError = () =>
  new ApiClientError(500, { statusCode: 500, error: 'Error', message: 'fixture' });

afterEach(() => {
  vi.resetAllMocks();
});

describe('loadComparedListings', () => {
  it('asks for the branding first, then for each compared car in saved order', async () => {
    const requests: string[] = [];
    api.getBranding.mockImplementation(async (options: unknown) => {
      requests.push(`branding ${JSON.stringify(options)}`);
      return { defaultCurrency: 'EUR' };
    });
    api.getListingBySlug.mockImplementation(async (slug: string, options: unknown) => {
      requests.push(`${slug} ${JSON.stringify(options)}`);
      return car(slug);
    });

    await expect(loadComparedListings(['b', 'a'])).resolves.toEqual({
      baseCurrency: 'EUR',
      saved: { listings: [car('b'), car('a')], goneSlugs: [], hasFailure: false },
    });
    expect(requests).toEqual([
      'branding {"revalidate":300}',
      'b {"revalidate":0}',
      'a {"revalidate":0}',
    ]);
  });

  // Requests that answer at once look the same issued together or one after another, so
  // here none ever answers: a load that waited for the branding would ask for no car.
  it('asks for the compared cars while the branding request is still unanswered', () => {
    const requests: string[] = [];
    const neverAnswered = new Promise<never>(() => {});
    api.getBranding.mockImplementation(() => {
      requests.push('branding');
      return neverAnswered;
    });
    api.getListingBySlug.mockImplementation((slug: string) => {
      requests.push(slug);
      return neverAnswered;
    });

    // Left pending on purpose: nothing rejects, and no timer or handle keeps the run alive.
    void loadComparedListings(['a', 'b']);

    expect(requests).toEqual(['branding', 'a', 'b']);
  });

  it('still compares the cars, without a common currency, when the branding fails', async () => {
    api.getBranding.mockRejectedValue(serverError());
    api.getListingBySlug.mockImplementation(async (slug: string) => car(slug));
    await expect(loadComparedListings(['a'])).resolves.toEqual({
      baseCurrency: undefined,
      saved: { listings: [car('a')], goneSlugs: [], hasFailure: false },
    });
  });

  it('asks for the branding even when nothing is compared', async () => {
    api.getBranding.mockResolvedValue({ defaultCurrency: 'USD' });
    await expect(loadComparedListings([])).resolves.toEqual({
      baseCurrency: 'USD',
      saved: { listings: [], goneSlugs: [], hasFailure: false },
    });
    expect(api.getListingBySlug).not.toHaveBeenCalled();
  });
});
