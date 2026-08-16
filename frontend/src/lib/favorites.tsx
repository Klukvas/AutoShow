'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  const persist = useCallback((next: string[]) => {
    setSlugs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / quota — favorites silently become session-only.
    }
  }, []);

  const value = useMemo<FavoritesValue>(
    () => ({
      slugs,
      ready,
      has: (slug) => slugs.includes(slug),
      toggle: (slug) =>
        persist(
          slugs.includes(slug)
            ? slugs.filter((s) => s !== slug)
            : [...slugs, slug].slice(-MAX_FAVORITES),
        ),
      remove: (slug) => persist(slugs.filter((s) => s !== slug)),
    }),
    [slugs, ready, persist],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
