import { describe, expect, it } from 'vitest';
import { nextPageParams, pageOffset, parseCursorNav, prevPageParams } from './cursor-stack';

describe('cursor stack pagination', () => {
  it('page 1 has no prev', () => {
    const nav = parseCursorNav({});
    expect(prevPageParams(nav)).toBeNull();
    expect(pageOffset(nav, 24)).toBe(1);
  });

  it('walks forward pushing the trail', () => {
    const p1 = parseCursorNav({});
    const to2 = nextPageParams(p1, 'c1');
    expect(to2).toEqual({ cursor: 'c1' });

    const p2 = parseCursorNav(to2);
    const to3 = nextPageParams(p2, 'c2');
    expect(to3).toEqual({ cursor: 'c2', stack: 'c1' });

    const p3 = parseCursorNav(to3);
    expect(pageOffset(p3, 24)).toBe(49);
    expect(nextPageParams(p3, 'c3')).toEqual({ cursor: 'c3', stack: 'c1~c2' });
  });

  it('walks back popping the trail', () => {
    const p3 = parseCursorNav({ cursor: 'c2', stack: 'c1' });
    expect(prevPageParams(p3)).toEqual({ cursor: 'c1' });

    const p2 = parseCursorNav({ cursor: 'c1' });
    // Back to page 1: no cursor at all.
    expect(prevPageParams(p2)).toEqual({});
  });
});
