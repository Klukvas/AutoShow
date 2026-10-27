'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Reveals the first card of a newly appended "load more" batch.
 *
 * This lives in its own component for one reason: it must never unmount. The
 * component is mounted for the whole life of the catalogue page (it renders
 * nothing), while `LoadMore` disappears exactly when the last page has been
 * appended — a scroll effect inside `LoadMore` would be torn down before its
 * `pending === false` pass could run, so the final batch stayed below the fold.
 *
 * The commit signal is `cursor` in `useSearchParams`: the hook only updates
 * after the navigation has committed and the new cards are already in the DOM.
 * Scrolling happens after paint (`requestAnimationFrame`), and only when the
 * `[data-catalog-new]` marker exists — a batch that added no new card (e.g. a
 * fully deduplicated page, or a filter change that dropped the cursor) must
 * not move the viewport at all, so there is no fallback anchor.
 *
 * Focus handoff: the click that appends the last batch (natural last page or
 * the MAX_PAGES cap) also removes the "load more" button, so the focused
 * element disappears and the browser drops focus to `<body>` — a keyboard user
 * would continue from the top of the document. When, and only when, focus is
 * stranded on `<body>` after the commit, we move it to the same marker
 * (`tabIndex={-1}` on the grid item). Middle clicks keep the button focused, so
 * they are untouched. `preventScroll` keeps the focus transfer from fighting
 * the scroll that was just requested.
 */
export function CatalogNewBatchScroller() {
  const searchParams = useSearchParams();
  const cursor = searchParams.get('cursor');
  const committedCursor = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // The first pass is the initial render, not a navigation commit; remember
    // the cursor so the next change (and only it) triggers a scroll.
    if (!mounted.current) {
      mounted.current = true;
      committedCursor.current = cursor;
      return;
    }
    if (committedCursor.current === cursor) return;
    committedCursor.current = cursor;

    const frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('[data-catalog-new]');
      if (!target) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      // LoadMore was unmounted by this commit → focus fell back to <body>.
      // Move it to the revealed card instead of leaving the user at the top of
      // the document (the marker is not tabbable itself; the next Tab enters
      // the card's own links).
      const active = document.activeElement;
      if (active === document.body || active === null) {
        target.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [cursor]);

  return null;
}
