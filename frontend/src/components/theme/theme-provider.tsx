'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  /** null until the client has read the attribute set by the head script. */
  theme: Theme | null;
  setTheme: (next: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  setTheme: () => undefined,
  toggle: () => undefined,
});

function readDomTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Owns the `data-theme` attribute after hydration. The inline head script
 * (theme-script.tsx) already applied the right theme pre-paint; this provider
 * syncs React state to it, persists explicit choices to localStorage and
 * follows system changes while the visitor has not chosen explicitly.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(readDomTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode) — theme still applies for the session.
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(readDomTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  // Follow the OS theme live, but only while the visitor has no stored choice.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === 'light' || stored === 'dark') return;
      const next: Theme = event.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      setThemeState(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
