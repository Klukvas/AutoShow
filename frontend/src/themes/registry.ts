import type { StorefrontTheme } from './contract';
import type { ThemeId } from './ids';
import { compactTheme } from './compact';
import { currentTheme } from './current';

// `satisfies` turns an id without a theme, or a theme without an id, into a compile error.
export const themes = {
  current: currentTheme,
  compact: compactTheme,
} as const satisfies Readonly<Record<ThemeId, StorefrontTheme>>;

export function getTheme(id: ThemeId): StorefrontTheme {
  return themes[id];
}
