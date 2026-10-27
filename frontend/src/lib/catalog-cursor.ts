import type { CursorPage, PublicListing } from '@/lib/api/types';

/**
 * Cursor pagination for the catalogue, shared by the RSC page and the
 * client-side "load more" button. "Load more" accumulates pages in the URL:
 * `cursor` is the page currently being appended, `stack` is the comma-separated
 * trail of cursors before it (oldest first, e.g. `?cursor=c3&stack=c1,c2`).
 * The root page has no cursor, so an explicitly present `stack` (even empty:
 * `?cursor=c1&stack=`) switches the page into accumulation mode and fetches
 * root + stack + cursor. A bare `cursor` without a stack is a legacy
 * single-page link and still renders exactly one page.
 *
 * One render fans out at most MAX_PAGES `listListings` calls: the root page,
 * the trail, and the current cursor. The trail therefore holds at most
 * MAX_PAGES - 2 cursors. The parser enforces this only as a defence against
 * hand-written URLs; LoadMore hides the button before a click could exceed the
 * budget, so a normal session never loses an already-shown page.
 */
export const MAX_PAGES = 7;
/** Trail slots: every page except the root and the current cursor. */
export const MAX_STACK_LENGTH = MAX_PAGES - 2;
/** Backend cursors are short base64url blobs; anything longer is garbage. */
export const MAX_CURSOR_LENGTH = 512;

/** One page of `publicApi.listListings`: root, trail entry or current cursor. */
export type CatalogPage = CursorPage<PublicListing>;

export type CatalogListings =
  | {
      ok: true;
      items: PublicListing[];
      nextCursor: string | null;
      total?: number;
      /** Index of the first card from the newest page (scroll target). */
      newStartIndex: number | null;
    }
  | { ok: false };

export interface CursorStack {
  /** `stack` is present → the URL renders accumulated pages (root included). */
  accumulate: boolean;
  cursors: string[];
}

/** Reads the trail out of the URL (see the module comment for the protocol). */
export function readCursorStack(
  search: Record<string, string | string[] | undefined>,
): CursorStack {
  const raw = search.stack;
  if (raw === undefined) return { accumulate: false, cursors: [] };
  const joined = (Array.isArray(raw) ? raw : [raw]).join(',');
  return {
    accumulate: true,
    cursors: joined
      .split(',')
      .filter((cursor) => cursor.length > 0 && cursor.length <= MAX_CURSOR_LENGTH)
      .slice(-MAX_STACK_LENGTH),
  };
}

/**
 * `listListings` calls the next "load more" click would trigger: the root
 * page, the trail with the current cursor appended, and the cursor being
 * loaded. LoadMore is not rendered when this exceeds MAX_PAGES — the button
 * disappears instead of the parser dropping the oldest page from a list the
 * user has already seen.
 */
export function nextFanOut(stack: CursorStack, cursor: string | undefined): number {
  return 1 + stack.cursors.length + (cursor ? 1 : 0) + 1;
}

/**
 * Trail the next click writes: the current trail plus the page shown right
 * now. Never trimmed — callers build it only when `nextFanOut` fits the
 * budget.
 */
export function buildNextStack(stack: CursorStack, current: string | undefined): string[] {
  const cursors = [...stack.cursors];
  if (current) cursors.push(current);
  return cursors;
}

/** Merges the cursor stack into one list: oldest page first, deduped by id. */
export function mergePages(pages: CatalogPage[]): CatalogListings {
  const items: PublicListing[] = [];
  const seen = new Set<string>();
  let newStartIndex: number | null = null;

  pages.forEach((page, pageIndex) => {
    if (pageIndex === pages.length - 1 && pages.length > 1) newStartIndex = items.length;
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  });

  const last = pages[pages.length - 1];
  return {
    ok: true,
    items,
    nextCursor: last?.nextCursor ?? null,
    total: last?.total,
    newStartIndex:
      pages.length > 1 && newStartIndex !== null && newStartIndex < items.length
        ? newStartIndex
        : null,
  };
}
