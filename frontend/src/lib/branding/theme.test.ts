import { describe, it, expect } from 'vitest';
import { brandingToTheme, brandingThemeCss, deriveDarkAccent, hexToRgbChannels } from './theme';
import type { Branding } from '../api/types';

const base: Branding = {
  id: '1',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#123456',
  accentColor: '#abcdef',
  displayName: 'AutoFlow',
  tagline: null,
  contactPhone: null,
  contactEmail: null,
  address: null,
  workingHours: null,
  socialLinks: null,
  seoDefaults: null,
  defaultCurrency: 'USD',
};

describe('brandingToTheme (hex validation guards CSS injection)', () => {
  it('uses handoff fallbacks when branding is null', () => {
    expect(brandingToTheme(null)).toEqual({ accent: '#2E53E6', accentHover: '#2340C0' });
  });

  it('passes through valid hex colors', () => {
    expect(brandingToTheme(base)).toEqual({ accent: '#123456', accentHover: '#abcdef' });
  });

  it('rejects a malformed / injected color and falls back', () => {
    const evil = { ...base, primaryColor: 'red;} body{display:none}', accentColor: 'javascript:1' };
    expect(brandingToTheme(evil)).toEqual({ accent: '#2E53E6', accentHover: '#2340C0' });
  });

  it('hexToRgbChannels converts #rrggbb and #rgb to channels', () => {
    expect(hexToRgbChannels('#2E53E6')).toBe('46 83 230');
    expect(hexToRgbChannels('#abcdef')).toBe('171 205 239');
    expect(hexToRgbChannels('#fff')).toBe('255 255 255');
  });

  it('hexToRgbChannels strips the alpha byte of #rrggbbaa', () => {
    expect(hexToRgbChannels('#2E53E6FF')).toBe('46 83 230');
  });
});

describe('deriveDarkAccent (dark theme keeps any brand colour legible)', () => {
  it('raises lightness of a dark brand colour to the floor', () => {
    // #14161B is near-black (L ≈ 0.09) — dark accent must be much lighter.
    const { accent } = deriveDarkAccent('#14161B');
    const [r, g, b] = accent.split(' ').map(Number);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luma).toBeGreaterThan(120);
  });

  it('does not darken an already-light colour, hover goes lighter', () => {
    const { accent, accentHover } = deriveDarkAccent('#7690EF'); // L ≈ 0.70
    // Property, not exact-string equality: the HSL round-trip may round ±1 per
    // channel — assert the colour was not dimmed instead of byte equality.
    const channels = (c: string) => c.split(' ').map(Number);
    const input = channels(hexToRgbChannels('#7690EF'));
    const output = channels(accent);
    output.forEach((ch, i) => expect(Math.abs(ch - input[i])).toBeLessThanOrEqual(2));
    const sum = (c: number[]) => c.reduce((a, n) => a + n, 0);
    expect(sum(channels(accentHover))).toBeGreaterThan(sum(output));
  });
});

describe('brandingThemeCss', () => {
  it('emits RGB-channel accent declarations for both themes, never leaks markup', () => {
    const css = brandingThemeCss({ ...base, primaryColor: '#fff</style>' });
    // primaryColor is malformed → accent falls back to #2E53E6; accentColor stays valid.
    expect(css).toContain(':root{--accent:46 83 230;--accent-hover:171 205 239;}');
    expect(css).toContain("[data-theme='dark']{--accent:");
    expect(css).not.toContain('</style>');
  });

  it('dark block lifts a dark brand accent above the lightness floor', () => {
    const css = brandingThemeCss({ ...base, primaryColor: '#DA291C', accentColor: '#B21F15' });
    expect(css).toContain(':root{--accent:218 41 28;--accent-hover:178 31 21;}');
    const darkAccent = css.match(/\[data-theme='dark'\]\{--accent:(\d+ \d+ \d+);/)?.[1];
    expect(darkAccent).toBeDefined();
    const [r] = darkAccent!.split(' ').map(Number);
    expect(r).toBeGreaterThan(218); // red channel lifted vs #DA291C
  });
});
