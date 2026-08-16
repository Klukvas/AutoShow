'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListingCard } from '@/components/listing/listing-card';
import { publicApi } from '@/lib/api/public';
import { useFavorites } from '@/lib/favorites';
import type { PublicListing } from '@/lib/api/types';

/**
 * Guest favorites, hydrated client-side: slugs live in localStorage, each car
 * is fetched by slug so prices/statuses are always current. A car that was
 * deleted (404) is pruned from storage silently.
 */
export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const { slugs, ready, remove } = useFavorites();
  const [items, setItems] = useState<PublicListing[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (slugs.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        slugs.map(async (slug) => {
          try {
            return await publicApi.getListingBySlug(slug, { revalidate: 0 });
          } catch {
            remove(slug); // deleted/unpublished — prune so the counter is honest
            return null;
          }
        }),
      );
      if (!cancelled) setItems(results.filter((l): l is PublicListing => l !== null));
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally NOT keyed on `slugs`: un-hearting a card on this page
    // must not refetch/reshuffle the grid under the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="font-heading text-title-lg font-extrabold text-ink">{t('title')}</h1>

      {items === null ? (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(Math.max(slugs.length, 3), 6) }, (_, i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-body-md text-ink-2">{t('empty')}</p>
          <Link
            href="/cars"
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-bold text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t('goCatalog')}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
