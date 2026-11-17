'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Currency, PublicListing } from '@/lib/api/types';
import { useCompare } from '@/lib/compare';
import { compareState, type CompareState } from './compare-state';
import { loadComparedListings } from './compared-listings';
import { pruneGoneListings } from './saved-listings';

export type CompareModel = Readonly<{
  t: ReturnType<typeof useTranslations<'compare'>>;
  state: CompareState;
  /** Loads the compared cars again; offered while `state.status` is `error`. */
  retry: () => void;
  /** Takes a car out of the comparison and out of the saved list. */
  removeCar: (slug: string) => void;
  setShowingOnlyDifferences: (isShowingOnlyDifferences: boolean) => void;
}>;

/**
 * Guest compare view: slugs from localStorage, each car hydrated by slug so
 * data is current. A lead form below the table sends the whole shortlist to
 * the manager.
 *
 * Only a car confirmed deleted (404) is pruned from storage; any other fetch
 * failure (500, timeout, offline) keeps the slug and offers a retry.
 */
export function useCompareModel(): CompareModel {
  const t = useTranslations('compare');
  const { slugs, ready, remove, removeMany } = useCompare();
  const [items, setItems] = useState<readonly PublicListing[] | null>(null);
  const [base, setBase] = useState<Currency | undefined>(undefined);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { baseCurrency, saved } = await loadComparedListings(slugs);
      if (cancelled) return;
      setBase(baseCurrency);
      setItems(saved.listings);
      setLoadFailed(saved.hasFailure);
      setLoading(false);
      // Below the `cancelled` check: nothing is written to storage after unmount.
      pruneGoneListings(saved, removeMany);
    })();
    return () => {
      cancelled = true;
    };
    // Not keyed on slugs: removing a column shouldn't refetch the whole grid.
    // Re-running is an explicit user action — `attempt` bumps on "retry".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt]);

  // Remove must drop the visible column too — `items` is intentionally not
  // keyed on `slugs`, so the context update alone wouldn't re-render the table.
  const removeCar = (slug: string) => {
    remove(slug);
    setItems((prev) => prev?.filter((l) => l.slug !== slug) ?? prev);
  };

  return {
    t,
    state: compareState({
      cars: items,
      baseCurrency: base,
      hasLoadFailure: loadFailed,
      isLoading: loading,
      isShowingOnlyDifferences: onlyDiff,
      lead: () => ({ siteOrigin: window.location.origin, heading: t('leadHeading') }),
    }),
    retry: () => setAttempt((n) => n + 1),
    removeCar,
    setShowingOnlyDifferences: setOnlyDiff,
  };
}
