import type { CatalogRef } from '@/lib/api/types';

/** Mirrors the backend limit on catalog_colors.name_uk. */
export const COLOR_NAME_MAX = 64;

export type ColorNameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: 'required' | 'tooLong' };

export function checkColorName(raw: string): ColorNameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, reason: 'required' };
  if (name.length > COLOR_NAME_MAX) return { ok: false, reason: 'tooLong' };
  return { ok: true, name };
}

/** The server may return an already listed color for a duplicate name. */
export function withColor(colors: readonly CatalogRef[], color: CatalogRef): CatalogRef[] {
  return colors.some((existing) => existing.id === color.id) ? [...colors] : [...colors, color];
}
