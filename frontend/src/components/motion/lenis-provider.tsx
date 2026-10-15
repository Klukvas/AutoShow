'use client';

import Lenis from '@studio-freight/lenis';
import { useEffect } from 'react';

/**
 * Lenis runs smooth scroll on the public storefront only. Honours
 * prefers-reduced-motion: if the user opted out, we never instantiate it and
 * the page uses the browser's native scrolling.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: Lenis | null = null;
    const syncLock = () => {
      if (document.documentElement.hasAttribute('data-scroll-locked')) lenis?.stop();
      else lenis?.start();
    };
    let raf = 0;
    const tick = (time: number) => {
      lenis?.raf(time);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
      document.documentElement.classList.remove('lenis');
    };
    const sync = () => {
      stop();
      if (preference.matches) return;
      lenis = new Lenis({
        lerp: 0.18,
        smoothWheel: true,
      });
      document.documentElement.classList.add('lenis');
      syncLock();
      raf = requestAnimationFrame(tick);
    };
    sync();
    const observer = new MutationObserver(syncLock);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-scroll-locked'],
    });
    preference.addEventListener('change', sync);
    return () => {
      preference.removeEventListener('change', sync);
      observer.disconnect();
      stop();
    };
  }, []);

  return <>{children}</>;
}
