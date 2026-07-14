/**
 * Cursor pagination with a "Назад" button on top of forward-only backend
 * cursors: the URL keeps the trail of cursors that led to the current page
 * (`stack` param). Cursors are base64url (no "~"), so "~" is a safe joiner.
 *
 * page 1: ?           → next: ?cursor=c1&stack=
 * page 2: ?cursor=c1  → next: ?cursor=c2&stack=c1 · prev: page 1
 * page 3: ?cursor=c2&stack=c1 → prev: ?cursor=c1&stack=
 */

const JOINER = '~';
/** Depth cap — a crafted URL must not blow up client-side link building. */
const MAX_STACK = 50;
/** Backend cursors are short base64url blobs; anything longer is garbage. */
const MAX_CURSOR_LENGTH = 512;

export interface CursorNav {
  cursor?: string;
  stack: string[];
}

export function parseCursorNav(params: { cursor?: string; stack?: string }): CursorNav {
  return {
    cursor: params.cursor || undefined,
    stack: params.stack
      ? params.stack
          .split(JOINER)
          .filter((c) => c.length > 0 && c.length <= MAX_CURSOR_LENGTH)
          .slice(-MAX_STACK)
      : [],
  };
}

/** Query params for the NEXT page given the backend's nextCursor. */
export function nextPageParams(nav: CursorNav, nextCursor: string): Record<string, string> {
  const stack = nav.cursor ? [...nav.stack, nav.cursor] : nav.stack;
  return {
    cursor: nextCursor,
    ...(stack.length ? { stack: stack.join(JOINER) } : {}),
  };
}

/** Query params for the PREVIOUS page, or null when already on page 1. */
export function prevPageParams(nav: CursorNav): Record<string, string> | null {
  if (!nav.cursor) return null;
  const prevCursor = nav.stack[nav.stack.length - 1];
  const rest = nav.stack.slice(0, -1);
  if (!prevCursor) return {}; // back to page 1 — no cursor at all
  return {
    cursor: prevCursor,
    ...(rest.length ? { stack: rest.join(JOINER) } : {}),
  };
}

/** 1-based index of the first row on the current page (for "Показано N–M"). */
export function pageOffset(nav: CursorNav, pageSize: number): number {
  const depth = nav.cursor ? nav.stack.length + 1 : 0;
  return depth * pageSize + 1;
}
