'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'autoflow:compare';
/** Side-by-side comparison stays readable up to 3 cars. */
export const MAX_COMPARE = 3;

interface CompareValue {
  /** Listing slugs, insertion-ordered. Empty until hydrated from localStorage. */
  slugs: string[];
  /** False during SSR/first paint — consumers hide counters until then. */
  ready: boolean;
  has: (slug: string) => boolean;
  /** True when the slug is present OR there's still room to add another. */
  canAdd: (slug: string) => boolean;
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareValue | null>(null);

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

/**
 * Guest compare list: up to {@link MAX_COMPARE} listing slugs in localStorage,
 * mirroring FavoritesProvider. Slugs (not ids) so the /compare page can hydrate
 * each car from the public by-slug API. Synced across tabs via `storage`.
 */
export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

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
      // Private mode / quota — compare list silently becomes session-only.
    }
  }, []);

  const value = useMemo<CompareValue>(
    () => ({
      slugs,
      ready,
      has: (slug) => slugs.includes(slug),
      canAdd: (slug) => slugs.includes(slug) || slugs.length < MAX_COMPARE,
      toggle: (slug) => {
        if (slugs.includes(slug)) {
          persist(slugs.filter((s) => s !== slug));
        } else if (slugs.length < MAX_COMPARE) {
          persist([...slugs, slug]);
        }
        // At capacity and not present → no-op; the button is disabled anyway.
      },
      remove: (slug) => persist(slugs.filter((s) => s !== slug)),
      clear: () => persist([]),
    }),
    [slugs, ready, persist],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}
