'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicListing } from '@/lib/api/types';
import { useFavorites } from '@/lib/favorites';
import { favoritesState, type FavoritesState } from './favorites-state';
import { loadSavedListings, pruneGoneListings } from './saved-listings';

export type FavoritesModel = Readonly<{
  t: ReturnType<typeof useTranslations<'favorites'>>;
  state: FavoritesState;
  /** Loads the saved cars again; offered while `state.status` is `error`. */
  retry: () => void;
}>;

/**
 * Guest favorites, hydrated client-side: slugs live in localStorage, each car
 * is fetched by slug so prices/statuses are always current. Only a car that is
 * confirmed deleted (404) is pruned from storage silently; any other failure
 * (500, timeout, offline) keeps the saved slug and offers a retry.
 */
export function useFavoritesModel(): FavoritesModel {
  const t = useTranslations('favorites');
  const { slugs, ready, removeMany } = useFavorites();
  const [items, setItems] = useState<readonly PublicListing[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const saved = await loadSavedListings(slugs);
      if (cancelled) return;
      setItems(saved.listings);
      setLoadFailed(saved.hasFailure);
      setLoading(false);
      // Below the `cancelled` check: nothing is written to storage after unmount.
      pruneGoneListings(saved, removeMany);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally NOT keyed on `slugs`: un-hearting a card on this page
    // must not refetch/reshuffle the grid under the cursor. A re-run is an
    // explicit user action — `attempt` bumps when "retry" is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt]);

  return {
    t,
    state: favoritesState({
      listings: items,
      hasLoadFailure: loadFailed,
      isLoading: loading,
      savedCount: slugs.length,
    }),
    retry: () => setAttempt((n) => n + 1),
  };
}
