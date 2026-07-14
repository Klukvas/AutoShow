import type { Branding } from '../api/types';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Handoff defaults — used when branding is missing or malformed. */
const FALLBACK_ACCENT = '#2E53E6';
const FALLBACK_ACCENT_HOVER = '#2340C0';

/**
 * Validate that a configured color is a real hex token before letting it
 * into our inline style — otherwise a malformed primaryColor could break the
 * CSS rule and produce a fallback nobody asked for.
 */
function safeHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return HEX_RE.test(value) ? value : fallback;
}

interface ThemeVars {
  accent: string;
  accentHover: string;
}

export function brandingToTheme(branding: Branding | null): ThemeVars {
  return {
    accent: safeHex(branding?.primaryColor, FALLBACK_ACCENT),
    accentHover: safeHex(branding?.accentColor, FALLBACK_ACCENT_HOVER),
  };
}

/**
 * Convert a validated #rgb / #rrggbb hex to the space-separated "r g b" channel
 * form our tokens use, so `rgb(var(--accent) / <alpha-value>)` stays valid.
 */
export function hexToRgbChannels(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  const int = parseInt(h.slice(0, 6), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}

/** Minimum lightness for an accent sitting on dark surfaces. */
const DARK_ACCENT_MIN_L = 0.6;
/** Hover on dark goes LIGHTER (mirrors darker-on-light hover). */
const DARK_HOVER_LIFT = 0.08;

/**
 * Derive dark-theme accent channels from the brand hex: keep hue/saturation,
 * raise lightness to a floor so any brand colour (including near-black ones)
 * stays legible on dark backgrounds.
 */
export function deriveDarkAccent(hex: string): { accent: string; accentHover: string } {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const base = Math.max(l, DARK_ACCENT_MIN_L);
  const hover = Math.min(base + DARK_HOVER_LIFT, 0.92);
  const [ar, ag, ab] = hslToRgb(h, s, base);
  const [hr, hg, hb] = hslToRgb(h, s, hover);
  return { accent: `${ar} ${ag} ${ab}`, accentHover: `${hr} ${hg} ${hb}` };
}

/**
 * Inline CSS string injected into <head> at SSR (before first paint) so the
 * brand accent applies without FOUC in BOTH themes. Light theme gets the
 * configured colours verbatim; dark theme gets a lightness-floored variant so
 * the accent keeps ≥AA contrast on dark surfaces. Emits RGB channels to match
 * the token contract in globals.css.
 */
export function brandingThemeCss(branding: Branding | null): string {
  const { accent, accentHover } = brandingToTheme(branding);
  const dark = deriveDarkAccent(accent);
  const light = `:root{--accent:${hexToRgbChannels(accent)};--accent-hover:${hexToRgbChannels(accentHover)};}`;
  const darkBlock = `[data-theme='dark']{--accent:${dark.accent};--accent-hover:${dark.accentHover};}`;
  return `${light}${darkBlock}`;
}
