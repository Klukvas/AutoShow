/**
 * Auto-derive the hover shade from a picked accent (handoff: hover is the
 * same hue, darker — #2E53E6 → #2340C0). Kept pure for unit tests.
 */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex);
}

export function normalizeHex(hex: string): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  return `#${h.toUpperCase()}`;
}

/** Darken by scaling lightness down ~18% (clamped) in HSL space. */
export function deriveHoverHex(hex: string): string {
  if (!isValidHex(hex)) return hex;
  const h = normalizeHex(hex).slice(1);
  const int = parseInt(h, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const [hue, sat, light] = rgbToHsl(r, g, b);
  const darker = Math.max(0, light * 0.78);
  const [nr, ng, nb] = hslToRgb(hue, sat, darker);
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
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
