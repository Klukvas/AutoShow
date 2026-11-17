import { describe, expect, it } from 'vitest';
import type { ThemeFonts } from './contract';
import { themeFontCss } from './theme-font-css';

const font = (fontFamily: string) => ({ style: { fontFamily } });

describe('theme font css', () => {
  it('is empty for a theme without own fonts, so nothing is added to the page', () => {
    expect(themeFontCss('current', { sans: null, display: null })).toBe('');
  });

  it("redefines the font variables on the storefront's body", () => {
    const fonts = { sans: font("'__Inter_1a2b', '__Inter_Fallback_1a2b'"), display: font('Lora') };
    expect(themeFontCss('acme', fonts)).toBe(
      ":root body:has([data-storefront-theme='acme'])" +
        "{--font-sans:'__Inter_1a2b', '__Inter_Fallback_1a2b';--font-display:Lora;}",
    );
  });

  it('leaves the role a theme does not replace to the app font', () => {
    expect(themeFontCss('acme', { sans: null, display: font('Lora') })).toBe(
      ":root body:has([data-storefront-theme='acme']){--font-display:Lora;}",
    );
  });

  it.each(["'Lora', 'Lora Fallback'", '"Onest","Onest Fallback"', 'Playfair Display, serif'])(
    'accepts a family list as next/font writes it (%s)',
    (fontFamily) => {
      expect(themeFontCss('acme', { sans: font(fontFamily), display: null })).toContain(
        `{--font-sans:${fontFamily};}`,
      );
    },
  );

  it.each([
    'Lora;} body{display:none',
    'Lora</style><script>',
    'url(x)',
    "Lora'",
    "'Lora",
    '\'Lora", serif',
    'Lora,\nserif',
    'Lora,',
    '',
  ])('refuses a family that would leave the declaration (%j)', (fontFamily) => {
    expect(() => themeFontCss('acme', { sans: font(fontFamily), display: null })).toThrow(
      'Theme font for --font-sans is not a font-family list',
    );
  });

  // What a fonts module with mistyped keys looks like once it is past the compiler.
  it.each([{ body: font('Lora'), heading: null }, { sans: null }, {}])(
    'refuses fonts that leave a role out instead of saying null (%j)',
    (fonts) => {
      expect(() => themeFontCss('acme', fonts as unknown as ThemeFonts)).toThrow(
        'Theme fonts do not say what',
      );
    },
  );

  it.each(["x']){} *{--bg:0 0 0}", 'Acme', '', '../current'])(
    'refuses an id that is not a theme folder name (%j)',
    (themeId) => {
      expect(() => themeFontCss(themeId, { sans: null, display: null })).toThrow(
        'Not a storefront theme id',
      );
    },
  );
});
