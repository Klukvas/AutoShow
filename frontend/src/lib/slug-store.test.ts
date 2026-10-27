import { describe, expect, it } from 'vitest';
import { appendSlug, removeSlugs, toggleSlug } from './slug-store';

describe('removeSlugs', () => {
  it('removes both 404 slugs from one batch instead of resurrecting the first', () => {
    const stored = ['bmw-x5', 'audi-a6', 'tesla-model-3'];

    // The batch the pages call after Promise.all: one update, both slugs gone.
    expect(removeSlugs(stored, ['bmw-x5', 'audi-a6'])).toEqual(['tesla-model-3']);
    // …and it must equal applying the removals one after another.
    expect(removeSlugs(removeSlugs(stored, ['bmw-x5']), ['audi-a6'])).toEqual([
      'tesla-model-3',
    ]);
  });

  it('ignores unknown slugs and returns the same reference when nothing changes', () => {
    const stored = ['bmw-x5', 'audi-a6'];

    expect(removeSlugs(stored, ['missing-car'])).toBe(stored);
    expect(removeSlugs(stored, [])).toBe(stored);
  });

  it('deduplicates the input list of slugs to remove', () => {
    const stored = ['a', 'b', 'c', 'd'];

    expect(removeSlugs(stored, ['b', 'b', 'd'])).toEqual(['a', 'c']);
  });

  it('keeps insertion order and does not mutate the source list', () => {
    const stored = ['a', 'b', 'c'];
    const copy = [...stored];

    expect(removeSlugs(stored, ['b'])).toEqual(['a', 'c']);
    expect(stored).toEqual(copy);
  });
});

describe('toggleSlug', () => {
  it('adds to the end and removes again, preserving order', () => {
    const stored = ['a', 'b'];
    const added = toggleSlug(stored, 'c');

    expect(added).toEqual(['a', 'b', 'c']);
    expect(added).not.toBe(stored);
    expect(toggleSlug(added, 'a')).toEqual(['b', 'c']);
    // the caller's list is never mutated in place
    expect(stored).toEqual(['a', 'b']);
  });

  it('is a no-op (same reference) when the list is full and the slug is absent', () => {
    const full = ['a', 'b', 'c'];

    expect(toggleSlug(full, 'd', 3)).toBe(full);
    // a slug that is already there is still removable at capacity
    expect(toggleSlug(full, 'b', 3)).toEqual(['a', 'c']);
  });

  it('reserves room up to the given max, then refuses new slugs', () => {
    const once = toggleSlug([], 'a', 2);
    const twice = toggleSlug(once, 'b', 2);

    expect(twice).toEqual(['a', 'b']);
    expect(toggleSlug(twice, 'c', 2)).toBe(twice);
  });
});

describe('appendSlug', () => {
  it('evicts the oldest entry when the list is full (favorites limit)', () => {
    const full = ['a', 'b', 'c'];
    const next = appendSlug(full, 'd', 3);

    expect(next).toEqual(['b', 'c', 'd']);
    expect(next).toHaveLength(3);
    // the caller's list is never mutated in place
    expect(full).toEqual(['a', 'b', 'c']);
  });

  it('returns the same reference when the slug is already saved', () => {
    const saved = ['a', 'b', 'c'];

    expect(appendSlug(saved, 'b', 3)).toBe(saved);
  });
});
