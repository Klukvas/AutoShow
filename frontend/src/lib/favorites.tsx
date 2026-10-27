'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { appendSlug, removeSlugs } from './slug-store';

const STORAGE_KEY = 'autoflow:favorites';
const MAX_FAVORITES = 100;

interface FavoritesValue {
  /** Listing slugs, insertion-ordered. Empty until hydrated from localStorage. */
  slugs: string[];
  /** False during SSR/first paint — consumers hide counters until then. */
  ready: boolean;
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
  /** Prunes several slugs in one update (e.g. a batch of confirmed 404s). */
  removeMany: (slugs: string[]) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Guest favorites: slugs in localStorage, no account needed. Slugs (not ids)
 * so the /favorites page can hydrate each car from the public by-slug API.
 * Synced across tabs via the `storage` event.
 *
 * Every mutation is a functional `setSlugs(prev => …)` over the pure helpers in
 * `slug-store`, so two changes in one tick (a batch of 404 prunes, a heart
 * click racing a fetch) compose instead of overwriting each other with a stale
 * render snapshot.
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate after mount — reading localStorage during render would make the
  // server and client HTML disagree.
  useEffect(() => {
    setSlugs(readStored());
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSlugs(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Persist from an effect, never from inside an updater: updaters must stay
  // pure (React may run them twice) and this way storage always mirrors the
  // committed state. The hydration pass rewrites the value it just read.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // Private mode / quota — favorites silently become session-only.
    }
  }, [slugs, ready]);

  const value = useMemo<FavoritesValue>(
    () => ({
      slugs,
      ready,
      has: (slug) => slugs.includes(slug),
      toggle: (slug) =>
        setSlugs((prev) =>
          prev.includes(slug)
            ? removeSlugs(prev, [slug])
            : appendSlug(prev, slug, MAX_FAVORITES),
        ),
      remove: (slug) => setSlugs((prev) => removeSlugs(prev, [slug])),
      removeMany: (targets) => setSlugs((prev) => removeSlugs(prev, targets)),
    }),
    [slugs, ready],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
