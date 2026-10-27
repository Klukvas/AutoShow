/**
 * Pure list helpers for the guest favorites / compare stores.
 *
 * These modules keep the only persisted identifier — listing slugs — so every
 * mutation is an immutable array transform. The providers hand them to
 * `setState(prev => …)`, which is what makes two removals in one tick both
 * land: the second updater sees the list produced by the first one instead of
 * a stale render snapshot.
 *
 * Returning the SAME reference when nothing changed lets React bail out of a
 * re-render (and the persistence effect skip a redundant write).
 */

/**
 * Adds `slug` to the end of `list`, or removes it if already present.
 * Insertion order is preserved. A full list (`length >= max`) refuses a new
 * slug — the same reference comes back so the caller can treat it as a no-op.
 */
export function toggleSlug(list: string[], slug: string, max = Number.POSITIVE_INFINITY): string[] {
  if (list.includes(slug)) return list.filter((item) => item !== slug);
  if (list.length >= max) return list;
  return [...list, slug];
}

/**
 * Appends `slug` to `list`, keeping at most `max` newest entries: when the
 * list is already full the oldest slug(s) fall off (`slice(-max)`), which is
 * how the favorites store behaved before. An already-present slug is a no-op
 * (same reference), so a click on a filled-in heart does not reorder anything.
 */
export function appendSlug(list: string[], slug: string, max: number): string[] {
  if (list.includes(slug)) return list;
  const next = [...list, slug];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Drops every slug from `slugs` (duplicates in the argument and unknown slugs
 * are ignored). Same reference when nothing was removed.
 */
export function removeSlugs(list: string[], slugs: string[]): string[] {
  if (slugs.length === 0) return list;
  const drop = new Set(slugs);
  const next = list.filter((slug) => !drop.has(slug));
  return next.length === list.length ? list : next;
}
