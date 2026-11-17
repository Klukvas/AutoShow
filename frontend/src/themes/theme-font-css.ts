import { storefrontScope, type ThemeFont, type ThemeFonts } from './contract';

// One family as next/font writes it: a quoted name or bare words. Checked name by name,
// so an unbalanced quote, a line break or anything else that could end the declaration
// or the <style> element is refused instead of being written into it.
const FONT_FAMILY = `(?:'[\\w .-]+'|"[\\w .-]+"|[\\w-]+(?: [\\w-]+)*)`;
const FONT_FAMILY_LIST = new RegExp(`^${FONT_FAMILY}(?:, ?${FONT_FAMILY})*$`);

function fontDeclaration(variable: string, font: ThemeFont | null | undefined): string {
  // A missing role is a mistyped key (`body` for `sans`), not "keep the app font": that
  // is `null`. tsc reports it through the theme's index.ts; this stops the build as well.
  if (font === undefined) {
    throw new Error(`Theme fonts do not say what ${variable} is: a next/font font or null`);
  }
  if (font === null) return '';
  const { fontFamily } = font.style;
  if (!FONT_FAMILY_LIST.test(fontFamily)) {
    throw new Error(`Theme font for ${variable} is not a font-family list: ${fontFamily}`);
  }
  return `${variable}:${fontFamily};`;
}

/**
 * CSS that makes the storefront use a theme's fonts, or '' when the theme brings none.
 * The variables are the ones src/lib/fonts.ts defines on `<html>`; redefined on the
 * storefront's `<body>`, every `font-family: var(--font-…)` below it resolves to the
 * theme font, portals included. The runtime `system` preset (installations.css) sets
 * the same variables on the wrapper inside `<body>` and therefore still wins there.
 */
export function themeFontCss(themeId: string, fonts: ThemeFonts): string {
  // Before anything else: it also refuses an id that is not a theme folder name.
  const scope = storefrontScope(themeId);
  const declarations =
    fontDeclaration('--font-sans', fonts.sans) + fontDeclaration('--font-display', fonts.display);
  return declarations ? `${scope}{${declarations}}` : '';
}
