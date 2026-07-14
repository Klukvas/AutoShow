import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * AutoFlow Tailwind config — vitrina handoff DNA:
 *   - light-first palette tracking CSS variables ([data-theme] switches them,
 *     per-tenant accent injected via SSR)
 *   - semantic radius scale (cards 13–15, inputs/buttons 9–13, chips 8/pill)
 *   - soft shadow tokens with a theme-aware colour channel
 *   - two families: Onest (text/UI) + Schibsted Grotesk (headings/numerals)
 *
 * Legacy names (dark-editorial era) are kept verbatim below where marked —
 * the admin area depends on them; do not change their values.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    borderRadius: {
      none: '0',
      chip: '8px', // rectangular chips
      btn: '9px', // compact buttons / selects (header CTA, rail selects)
      input: '11px', // roomier inputs
      DEFAULT: '13px',
      card: '14px', // cards / panels (13–15 band)
      window: '15px', // window chrome / gallery main photo
      hero: '18px', // editorial large photo
      sheet: '22px', // mobile bottom sheet
      pill: '9999px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      card: '0 16px 32px -18px rgb(var(--shadow) / 0.32)',
      panel: '0 18px 40px -26px rgb(var(--shadow) / 0.30)',
      'cta-sticky': '0 -8px 24px -12px rgb(var(--shadow) / 0.18)',
    },
    fontFamily: {
      sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      // Headings/numerals — Schibsted Grotesk has no cyrillic, so Ukrainian
      // glyphs fall through to Onest (var(--font-sans)) per the handoff stack.
      heading: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      /* ---- Handoff scale (weights applied via font-* utilities) ---- */
      label: ['0.75rem', { lineHeight: '1.35', letterSpacing: '0.08em' }], // 12 labels
      sub: ['0.78125rem', { lineHeight: '1.4' }], // 12.5 card sub-line
      'body-md': ['0.90625rem', { lineHeight: '1.75' }], // 14.5 body copy
      'card-title': ['0.96875rem', { lineHeight: '1.35' }], // 15.5/700 grid title
      'price-sm': ['1.125rem', { lineHeight: '1.2' }], // 18/800 grid price
      section: ['1.21875rem', { lineHeight: '1.3' }], // 19.5/700 section H2
      'title-sm': ['1.3125rem', { lineHeight: '1.25' }], // 21 mobile title
      'price-md': ['1.6875rem', { lineHeight: '1.1' }], // 27/800 mobile price
      'title-lg': ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }], // 30/800 H1
      'price-lg': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }], // 32/800 big price
      hero: ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.015em' }], // 36/800 hero
      'price-xl': ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }], // 44/900
      editorial: ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }], // 52/900

      /* ---- Legacy scale (admin + unmigrated files) — keep verbatim ---- */
      eyebrow: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.1em' }], // 11
      micro: ['0.8125rem', { lineHeight: '1.4' }], // 13
      body: ['1rem', { lineHeight: '1.5' }], // 16
      lead: ['1.25rem', { lineHeight: '1.4' }], // 20
      h6: ['1.625rem', { lineHeight: '1.2' }], // 26
      h4: ['2.25rem', { lineHeight: '1.1' }], // 36
      h2: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.01em' }], // 56
      display: ['5.5rem', { lineHeight: '1', letterSpacing: '-0.015em' }], // 88
      numeral: ['8.75rem', { lineHeight: '0.95', letterSpacing: '-0.02em' }], // 140
    },
    extend: {
      colors: {
        /* ---- Semantic, theme-varying (rgb channels; /opacity works) ---- */
        bg: 'rgb(var(--bg) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-warm': 'rgb(var(--surface-warm) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--ink-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--ink-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-input': 'rgb(var(--line-input) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        'line-hover': 'rgb(var(--line-hover) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        focus: 'rgb(var(--focus) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        'ok-bg': 'rgb(var(--ok-bg) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-strong': 'rgb(var(--warn-strong) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-bg': 'rgb(var(--danger-bg) / <alpha-value>)',
        'danger-line': 'rgb(var(--danger-line) / <alpha-value>)',
        ratelimit: 'rgb(var(--ratelimit) / <alpha-value>)',
        'ratelimit-2': 'rgb(var(--ratelimit-2) / <alpha-value>)',
        'ratelimit-bg': 'rgb(var(--ratelimit-bg) / <alpha-value>)',
        'ratelimit-line': 'rgb(var(--ratelimit-line) / <alpha-value>)',
        'ph-a': 'rgb(var(--ph-a) / <alpha-value>)',
        'ph-b': 'rgb(var(--ph-b) / <alpha-value>)',
        'ph-glyph': 'rgb(var(--ph-glyph) / <alpha-value>)',
        skeleton: 'rgb(var(--skeleton) / <alpha-value>)',
        'skeleton-hi': 'rgb(var(--skeleton-hi) / <alpha-value>)',

        /* ---- Admin backoffice (dark sidebar + lifecycle badges) ---- */
        'sb-bg': 'rgb(var(--sb-bg) / <alpha-value>)',
        'sb-ink': 'rgb(var(--sb-ink) / <alpha-value>)',
        'sb-ink-2': 'rgb(var(--sb-ink-2) / <alpha-value>)',
        'sb-muted': 'rgb(var(--sb-muted) / <alpha-value>)',
        'sb-faint': 'rgb(var(--sb-faint) / <alpha-value>)',
        // Alpha-baked — use without an /opacity modifier.
        'sb-line': 'var(--sb-line)',
        'sb-active': 'var(--sb-active)',
        'sb-input-line': 'var(--sb-input-line)',
        'sb-input-bg': 'var(--sb-input-bg)',
        'st-draft-bg': 'rgb(var(--st-draft-bg) / <alpha-value>)',
        'st-draft-fg': 'rgb(var(--st-draft-fg) / <alpha-value>)',
        'st-published-bg': 'rgb(var(--st-published-bg) / <alpha-value>)',
        'st-published-fg': 'rgb(var(--st-published-fg) / <alpha-value>)',
        'st-reserved-bg': 'rgb(var(--st-reserved-bg) / <alpha-value>)',
        'st-reserved-fg': 'rgb(var(--st-reserved-fg) / <alpha-value>)',
        'st-sold-bg': 'rgb(var(--st-sold-bg) / <alpha-value>)',
        'st-sold-fg': 'rgb(var(--st-sold-fg) / <alpha-value>)',
        'st-archived-bg': 'rgb(var(--st-archived-bg) / <alpha-value>)',
        'st-archived-fg': 'rgb(var(--st-archived-fg) / <alpha-value>)',
        thead: 'rgb(var(--thead) / <alpha-value>)',

        /* ---- Legacy (admin + unmigrated files) — keep verbatim ---- */
        'bg-dark': 'rgb(var(--bg-dark) / <alpha-value>)',
        'surface-dark': 'rgb(var(--surface-dark) / <alpha-value>)',
        'surface-dark-2': 'rgb(var(--surface-dark-2) / <alpha-value>)',
        'bg-light': 'rgb(var(--bg-light) / <alpha-value>)',
        'surface-soft-light': 'rgb(var(--surface-soft-light) / <alpha-value>)',
        'surface-strong-light': 'rgb(var(--surface-strong-light) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        'muted-on-dark': 'rgb(var(--muted-on-dark) / <alpha-value>)',
        'muted-on-light': 'rgb(var(--muted-on-light) / <alpha-value>)',
        // Hairlines carry a baked alpha — used without an /opacity modifier.
        'hairline-dark': 'var(--hairline-dark)',
        'hairline-light': 'var(--hairline-light)',
      },
      letterSpacing: {
        tight: '-0.015em',
        editorial: '-0.01em',
        eyebrow: '0.1em',
        cta: '0.06em',
        'label-wide': '0.14em',
      },
      fontWeight: {
        regular: '400',
        editorial: '500',
        display: '700', // legacy: admin uses font-display as a WEIGHT utility
      },
      spacing: {
        slab: 'clamp(4rem, 8vw, 8rem)',
        header: '70px',
        rail: '288px',
      },
      transitionDuration: {
        instant: '0ms',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.tabular': {
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': '"tnum" 1, "lnum" 1',
        },
        '.editorial-grid': {
          'padding-inline': 'clamp(1.25rem, 5vw, 6rem)',
        },
        '.hairline-top': {
          'border-top': '1px solid var(--hairline-light)',
        },
        '.hairline-bottom': {
          'border-bottom': '1px solid var(--hairline-light)',
        },
        '.hairline-top-dark': {
          'border-top': '1px solid var(--hairline-dark)',
        },
        // Focus ring via box-shadow instead of outline — outline gets clipped
        // by `overflow-hidden` parents (listing cards, gallery tiles). The gap
        // ring uses var(--bg) so it adapts to the active theme; the outer ring
        // is the teal focus token (deliberately distinct from the accent).
        '.focus-ring:focus-visible': {
          outline: 'none',
          'box-shadow': '0 0 0 2px rgb(var(--bg)), 0 0 0 4px rgb(var(--focus))',
        },
      });
    }),
  ],
};

export default config;
