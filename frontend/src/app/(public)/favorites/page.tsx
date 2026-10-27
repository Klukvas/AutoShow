'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListingCard } from '@/components/listing/listing-card';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { useFavorites } from '@/lib/favorites';
import type { PublicListing } from '@/lib/api/types';

/**
 * Guest favorites, hydrated client-side: slugs live in localStorage, each car
 * is fetched by slug so prices/statuses are always current. Only a car that is
 * confirmed deleted (404) is pruned from storage silently; any other failure
 * (500, timeout, offline) keeps the saved slug and offers a retry.
 */
export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const { slugs, ready, removeMany } = useFavorites();
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    if (slugs.length === 0) {
      return { list: [] as PublicListing[], pruned: [] as string[], failed: false };
    }
    let failed = false;
    const pruned: string[] = [];
    const results = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return await publicApi.getListingBySlug(slug, { revalidate: 0 });
        } catch (err) {
          // Only a confirmed 404 means the car is gone: a 500, a timeout or an
          // offline tab must never erase a slug the guest explicitly saved.
          if (err instanceof ApiClientError && err.status === 404) {
            pruned.push(slug); // collect; the whole batch is pruned in one update
          } else {
            failed = true;
          }
          return null;
        }
      }),
    );
    return { list: results.filter((l): l is PublicListing => l !== null), pruned, failed };
  }, [slugs]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { list, pruned, failed } = await load();
      if (cancelled) return;
      setItems(list);
      setLoadFailed(failed);
      setLoading(false);
      // One functional update for the whole batch: prunes of deleted cars
      // compose instead of overwriting each other's stale snapshot. Nothing is
      // written after unmount.
      if (pruned.length > 0) removeMany(pruned);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally NOT keyed on `slugs`: un-hearting a card on this page
    // must not refetch/reshuffle the grid under the cursor. A re-run is an
    // explicit user action — `attempt` bumps when "retry" is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="font-heading text-title-lg font-medium text-ink">{t('title')}</h1>

      {loadFailed && (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-card border border-danger-line bg-danger-bg p-4">
          <p role="alert" className="text-sub font-medium text-danger">
            {t('loadError')}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            disabled={loading}
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {items === null ? (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(Math.max(slugs.length, 3), 6) }, (_, i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : loadFailed ? null : (
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-body-md text-ink-2">{t('empty')}</p>
          <Link
            href="/cars"
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t('goCatalog')}
          </Link>
        </div>
      )}
    </div>
  );
}
