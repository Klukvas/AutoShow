import { describe, expect, it } from 'vitest';
import type { PublicListing } from './api/types';
import {
  MAX_CURSOR_LENGTH,
  MAX_PAGES,
  MAX_STACK_LENGTH,
  buildNextStack,
  mergePages,
  nextFanOut,
  readCursorStack,
  type CatalogPage,
  type CursorStack,
} from './catalog-cursor';

const card = (id: string) => ({ id }) as unknown as PublicListing;

const page = (ids: string[], nextCursor: string | null = null, total?: number): CatalogPage => ({
  items: ids.map(card),
  nextCursor,
  ...(total === undefined ? {} : { total }),
});

describe('readCursorStack', () => {
  it('does not accumulate when the stack parameter is absent', () => {
    expect(readCursorStack({})).toEqual({ accumulate: false, cursors: [] });
    expect(readCursorStack({ cursor: 'c1' })).toEqual({ accumulate: false, cursors: [] });
  });

  it('accumulates on an explicitly present but empty stack', () => {
    expect(readCursorStack({ cursor: 'c1', stack: '' })).toEqual({
      accumulate: true,
      cursors: [],
    });
  });

  it('joins repeated stack parameters in order', () => {
    expect(readCursorStack({ stack: ['c1', 'c2'] })).toEqual({
      accumulate: true,
      cursors: ['c1', 'c2'],
    });
    // Each repeated param may itself carry a comma trail; the client passes
    // `getAll('stack')` and must see exactly what the RSC parser sees.
    expect(readCursorStack({ stack: ['a,b,c', 'd'] })).toEqual({
      accumulate: true,
      cursors: ['a', 'b', 'c', 'd'],
    });
  });

  it('drops empty and oversized cursors, keeping the newest trail slots', () => {
    const oversized = 'x'.repeat(MAX_CURSOR_LENGTH + 1);
    const garbage = ['c1', '', oversized, 'c2', 'c3', 'c4', 'c5', 'c6'].join(',');
    expect(readCursorStack({ stack: garbage })).toEqual({
      accumulate: true,
      cursors: ['c2', 'c3', 'c4', 'c5', 'c6'],
    });
    expect(readCursorStack({ stack: garbage }).cursors).toHaveLength(MAX_STACK_LENGTH);
  });

  it('keeps a cursor of exactly the maximum length', () => {
    const edge = 'y'.repeat(MAX_CURSOR_LENGTH);
    expect(readCursorStack({ stack: edge }).cursors).toEqual([edge]);
  });
});

describe('nextFanOut', () => {
  it('pins the product cap the boundary below is written against', () => {
    // The 7/8 case is only meaningful while these two hold.
    expect(MAX_PAGES).toBe(7);
    expect(MAX_STACK_LENGTH).toBe(5);
  });

  it('fits exactly MAX_PAGES and rejects one more', () => {
    const four: CursorStack = { accumulate: true, cursors: ['c1', 'c2', 'c3', 'c4'] };
    // root + 4 trail + current + the page being loaded
    expect(nextFanOut(four, 'c5')).toBe(MAX_PAGES);
    const five: CursorStack = { accumulate: true, cursors: [...four.cursors, 'c5'] };
    expect(nextFanOut(five, 'c6')).toBe(MAX_PAGES + 1);
    // At the cap a bare reload (no current cursor) is still within budget.
    expect(nextFanOut(five, undefined)).toBe(MAX_PAGES);
  });

  it('counts a plain first render as one page plus the next fetch', () => {
    expect(nextFanOut({ accumulate: false, cursors: [] }, undefined)).toBe(2);
  });
});

describe('buildNextStack', () => {
  it('appends the current cursor without mutating the stack', () => {
    const stack: CursorStack = { accumulate: true, cursors: ['c1', 'c2'] };
    expect(buildNextStack(stack, 'c3')).toEqual(['c1', 'c2', 'c3']);
    expect(stack.cursors).toEqual(['c1', 'c2']);
  });

  it('writes an empty trail when nothing has been shown yet', () => {
    expect(buildNextStack({ accumulate: true, cursors: [] }, undefined)).toEqual([]);
  });

  it('does not trim — the caller only builds it inside the budget', () => {
    const cursors = Array.from({ length: MAX_STACK_LENGTH }, (_, i) => `c${i}`);
    expect(buildNextStack({ accumulate: true, cursors }, 'now')).toEqual([...cursors, 'now']);
  });
});

describe('mergePages', () => {
  it('deduplicates by id and preserves page order', () => {
    expect(mergePages([page(['a', 'b'], 'c2', 10), page(['b', 'c'], 'c3', 10)])).toEqual({
      ok: true,
      items: [card('a'), card('b'), card('c')],
      nextCursor: 'c3',
      total: 10,
      newStartIndex: 2,
    });
  });

  it('points newStartIndex at the first card of the newest page', () => {
    const merged = mergePages([page(['a', 'b']), page(['c', 'd']), page(['e', 'f'], 'c4')]);
    if (!merged.ok) throw new Error('expected a merged page');
    expect(merged.newStartIndex).toBe(4);
    expect(merged.items[4]?.id).toBe('e');
    expect(merged.nextCursor).toBe('c4');
  });

  it('renders a single page without a scroll target', () => {
    expect(mergePages([page(['a', 'b'], null, 2)])).toEqual({
      ok: true,
      items: [card('a'), card('b')],
      nextCursor: null,
      total: 2,
      newStartIndex: null,
    });
  });

  it('has no scroll target when the newest page added nothing', () => {
    const merged = mergePages([page(['a', 'b'], 'c2'), page([], 'c3')]);
    if (!merged.ok) throw new Error('expected a merged page');
    expect(merged.newStartIndex).toBeNull();
    expect(merged.nextCursor).toBe('c3');
  });

  it('takes nextCursor and total from the last page', () => {
    const merged = mergePages([page(['a'], 'c2', 10), page(['b'], 'c3', 42)]);
    if (!merged.ok) throw new Error('expected a merged page');
    expect(merged.total).toBe(42);
    expect(merged.nextCursor).toBe('c3');
  });
});
