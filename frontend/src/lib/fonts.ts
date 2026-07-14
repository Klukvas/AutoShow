import { Onest, Schibsted_Grotesk } from 'next/font/google';

/**
 * Two-family system from the vitrina handoff:
 *   - Onest — text/UI, full Cyrillic coverage (400–800 via variable font).
 *   - Schibsted Grotesk — headings & numerals (500–900 via variable font).
 *
 * Schibsted Grotesk has NO cyrillic subset on Google Fonts, so the heading
 * stack falls back per-glyph to Onest for Ukrainian text while Latin words,
 * digits and prices keep Schibsted — exactly the fallback the handoff
 * prescribes ("Schibsted Grotesk","Onest",system-ui).
 *
 * Both are variable fonts: omitting `weight` serves one file per family with
 * every weight available. Applied to <html> via .variable so Tailwind's
 * font-sans / font-heading utilities pick them up.
 */
export const fontSans = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const fontDisplay = Schibsted_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});
