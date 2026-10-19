/** Text helpers shared by the listing AI checks. */

/** Lower-case, collapse whitespace, unify apostrophes and dashes. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’ʼ`']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "45 000", "45 000", "2,0" → number; anything else → null. */
export function parseNumber(value: string): number | null {
  const compact = value.replace(/[\s  ]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(compact) ? Number(compact) : null;
}

/** "45 000" and "45.000" are thousands groups, not a decimal: read digits only. */
export function parseGrouped(value: string): number | null {
  return /^\d{1,3}([\s  .]\d{3})+$/.test(value.trim())
    ? Number(value.replace(/\D/g, ''))
    : parseNumber(value);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A regex fragment that is not preceded / followed by a letter or digit (any script). */
export const NOT_AFTER_WORD = '(?<![\\p{L}\\d])';
export const NOT_BEFORE_WORD = '(?![\\p{L}\\d])';
