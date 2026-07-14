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
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    document.documentElement.classList.add('lenis');

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      document.documentElement.classList.remove('lenis');
    };
  }, []);

  return <>{children}</>;
}
