'use client';

import { useRef, type ReactNode } from 'react';

/** Horizontal review strip. Scrolling works without these buttons; they only page it. */
export function ReviewsCarousel({
  children,
  previousLabel,
  nextLabel,
}: {
  children: ReactNode;
  previousLabel: string;
  nextLabel: string;
}) {
  const track = useRef<HTMLDivElement>(null);

  const page = (direction: number) => {
    const node = track.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollBy({
      left: direction * Math.min(node.clientWidth * 0.85, 380),
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="home-reviews">
      <div className="home-reviews-controls">
        <button
          type="button"
          className="focus-ring"
          aria-label={previousLabel}
          onClick={() => page(-1)}
        >
          <span aria-hidden>←</span>
        </button>
        <button type="button" className="focus-ring" aria-label={nextLabel} onClick={() => page(1)}>
          <span aria-hidden>→</span>
        </button>
      </div>
      <div ref={track} className="home-reviews-track">
        {children}
      </div>
    </div>
  );
}
