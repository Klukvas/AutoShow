---
version: alpha
name: Code editorial — Frame (video / frame layer)
description: >
  Video-first companion to Code editorial's design.md. The unit is the frame (1920×1080). Atoms are
  identical and sacred — warm cream paper (never pure white, never cool), a single terracotta coral
  as scarce "voltage", hairline ink elevation (no heavy shadow), Onest for all
  display + Onest body + JetBrains Mono for the index/code voice on a warm-navy code surface,
  sentence-case display, and the ✱ coral spike mark. Composition + frame scale rewritten. Motion out
  of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  ink: "#211D16"
  cream: "#FBF8F1"
  tile: "#F2EBDB"
  tile-strong: "#7C642D"
  coral: "#B4453C"
  navy: "#181515"
  navy-soft: "#1F1C1B"
  navy-elev: "#252120"

borders: { hairline: "1px solid ink@12%", hairline-strong: "1px solid ink@20%", dark: "1px solid cream@14% (on navy)" }
shadows: { card: "0 1px 3px ink@8%, 0 4px 16px ink@4%", none: "none" }

typography:
  # — reading + chrome ramp —
  body:    { fontFamily: "Onest", cqw: 1.5, weight: 400, lineHeight: 1.5 }
  lead:    { fontFamily: "Onest", cqw: 2.08, weight: 400, lineHeight: 1.5 }
  card-title:{ fontFamily: "Onest", cqw: 2.3, weight: 600, lineHeight: 1.25, tracking: "-0.005em" }
  button:  { fontFamily: "Onest", cqw: 1.46, weight: 600, lineHeight: 1.0 }
  tag-upper:{ fontFamily: "Onest", cqw: 1.35, weight: 600, tracking: "0.18em", upper: true }
  kicker:  { fontFamily: "JetBrains Mono", px: 28, cqw: 1.46, weight: 600, tracking: "0.16em", upper: true }
  mono-label:{ fontFamily: "JetBrains Mono", px: 26, cqw: 1.35, weight: 600, tracking: "0.02em" }
  code:    { fontFamily: "JetBrains Mono", cqw: 1.67, weight: 400, lineHeight: 1.6 }
  # — display ramp (Onest 400, sentence case, negative tracking. Renderer embeds only 400/700 — author at 400; italic is the synthesized slant) —
  headline:{ fontFamily: "Onest", cqw: 4.6, weight: 400, lineHeight: 1.06, tracking: "-0.018em" }
  quote-pull:{ fontFamily: "Onest", cqw: 5.0, weight: 400, lineHeight: 1.12, tracking: "-0.012em", italic: true }
  display-italic:{ fontFamily: "Onest", cqw: 6.7, weight: 400, lineHeight: 1.05, tracking: "-0.012em", italic: true }
  display:{ fontFamily: "Onest", cqw: 7.3, weight: 400, lineHeight: 1.02, tracking: "-0.022em" }
  number-hero:{ fontFamily: "Onest", cqw: 9.4, weight: 400, lineHeight: 0.95, tracking: "-0.025em" }
  display-cover:{ fontFamily: "Onest", cqw: 9.9, weight: 400, lineHeight: 0.98, tracking: "-0.028em" }
  number-unit:{ fontFamily: "JetBrains Mono", cqw: 2.08, weight: 600, lineHeight: 1.0 }

spacing:
  slide-pad: "4.2cqw"   # ~80px @1920
  gap-md: "1.7cqw"
  hairline: "1px"
  radius-sm: "6px"
  radius-md: "8px"
  radius-lg: "12px"
  radius-pill: "9999px"

components:
  card-hairline:
    backgroundColor: "{colors.cream} or {colors.tile}"
    border: "1px solid {colors.ink}@12%"
    rounded: "{spacing.radius-lg}"
    shadow: "{shadows.card}"
    typography: "{typography.card-title} + {typography.body}"
    description: "The editorial content card. Elevation is the hairline + ONE soft warm shadow — never a heavy drop, glow, or gradient."
  kicker-spike:
    typography: "{typography.kicker}"
    mark: "✱ coral spike prefix"
    description: "The eyebrow — JetBrains Mono uppercase, indexical (2–5 words), prefixed with the coral ✱. Never plain text, never a sentence."
  coral-callout:
    backgroundColor: "{colors.coral} (full-bleed) or {colors.cream} with a coral edge"
    textColor: "{colors.cream} on coral"
    rounded: "{spacing.radius-md}"
    typography: "{typography.button} / {typography.h2}"
    description: "The ONE voltage moment per frame — the CTA, the single inline link, OR the full-bleed band. Never two corals in one frame."
  number-lockup:
    typography: "{typography.number-hero} figure + {typography.number-unit} unit"
    description: "Hero stat — a Onest figure paired with a JetBrains Mono unit (200K, +1,204, −318, 17 files). Figure is serif; the unit is ALWAYS mono, never the serif."
  pull-quote:
    typography: "{typography.quote-pull} (Onest italic) + {typography.tag-upper} cite"
    description: "A commit message, a reviewer line, or the thesis. Onest italic, small Onest uppercase cite beneath."
  section-rule:
    rule: "1px solid {colors.ink}@12% (or {colors.cream}@14% on navy)"
    description: "The only separator. A coral 1px rule may draw on to introduce a section. Never 2px+, never a heavy divider."
  code-surface:
    backgroundColor: "{colors.navy} body / {colors.navy-elev} title bar + status strip"
    textColor: "{colors.cream} (JetBrains Mono); syntax in coral (keywords) / teal #5DB8A6 (strings) / amber #E8A55A (numbers)"
    border: "1px solid {colors.cream}@14%"
    rounded: "{spacing.radius-md}"
    description: "The warm-navy code / terminal surface. The CODE ITSELF is rendered by the code-* registry blocks (code-diff / code-typing / code-snippet-*); this preset owns the surrounding surface, title bar, status strip, and mono chrome — not the code rendering."
  spike-mark:
    glyph: "✱ (U+2731), always {colors.coral}"
    description: "The brand mark. Fades + scales 0.92→1 on a single emphasis beat; never spins."
---

> **AutoFlow reel overrides (read first):** Onest here is a modern geometric SANS with full Cyrillic + Latin + digits (ignore any "old-style serif" wording below — that is leftover from the preset). Display = Onest 800, body = Onest 400/600, labels = JetBrains Mono 600 uppercase. All three faces are local in assets/fonts (see the @font-face block at the end). Canvas is 1080x1920 portrait; Reels safe box x 48–948, y 160–1560.

# Code editorial — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **code-editorial** preset remixed onto the captured brand. The YAML frontmatter above (colors · typography · components) is **normative and already correct — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — already set to **Onest** (display) / **Schibsted Grotesk** (body); ignore any preset font name lingering in prose.
- **Weights** — the brand font ships `{400, 600, 700, 800, 900}` only; every weight is clamped to these — ignore higher preset weights (e.g. 600/700) in prose.
- **Colors** — use the frontmatter hex; preset color NAMES in prose (e.g. "cobalt", "cream") mean the remapped brand values.


## Overview

Code editorial at frame scale is a **warm-editorial brand book come to life** — the register of a literary
imprint or a research note. The thesis is three colors: **cream is the ground, ink is the voice,
coral is the voltage** — and a fourth (warm navy) only where code shows itself. Every surface is
**warm cream** (never pure white, never cool gray); content gathers on a **tile** surface half a
step darker — the demarcation is a half-step, never a hard contrast. Elevation is a **1px hairline**
ink border at low alpha plus, rarely, one soft warm shadow. There are no heavy drops, no glows, no
gradients on content.

Three editorial voices, each in its own face: **Onest** carries every display moment — covers,
headlines, pull-quotes, big stat numerals — at large display sizes with gentle negative tracking;
its **italic** is the expressive register. **Onest** carries body, leads, card titles, buttons, and
UI chrome. **JetBrains Mono** carries the indexical layer — kickers, technical labels, the code
window, status strips. Switching a voice's face collapses the register: a sans headline or a serif
label reads as a different brand.

**Key characteristics at frame scale:**

- **Cream / ink / coral trinity** + a warm-navy code surface; cream is the default ground, ink the voice, coral the scarce voltage.
- **Onest** (sentence case, negative-tracked) for all display; **Onest** body/chrome; **JetBrains Mono** index + code.
- **Hairline elevation** — a 1px low-alpha ink border + at most one soft warm shadow. No heavy drop, glow, or gradient.
- **Coral is rationed** — at most ONE coral moment per frame (CTA, inline link, OR full-bleed band); coral never sets a headline or a body run.
- **Density is free** — fill the frame as the content wants; a frame may stand on a single focal or carry a dense, layered composition.
- **The ✱ coral spike** opens kickers; warm navy is reserved for the code/terminal surface.

## The Frame

### Frame Craft Bar

Eyeball tests gate every frame before any structural check:

- **Squint** — one Onest display moment dominates at 3–6× its neighbor.
- **Trinity** — cream/tile ground, ink text, coral exactly **once**; warm navy only on the code surface; no cool gray / pure white / fourth hue.
- **Type** — Onest sentence-case display (negative-tracked); Onest 400 body; JetBrains Mono kickers (uppercase 0.16em, coral ✱) + code.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `slide-pad` ~4.2cqw; the kicker/mono chrome sit inside it.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Hairlines stay 1px; card radii stay
6/8/12px; the warm-paper reading must survive every ratio.

## Colors

Tokens identical to the source. Default ground `{colors.cream}`; content gathers on
`{colors.tile}` / `{colors.tile-strong}` (half-step warm steps, never a hard contrast).
**Headlines & body:** `{colors.ink}` on cream/tile; `{colors.cream}` on navy. **Coral**
(`{colors.coral}`) is the scarce voltage — one moment per frame (CTA, inline link, or full-bleed
band), never body text, never a card fill. **Warm navy** (`{colors.navy}` / `navy-soft` /
`navy-elev`) is the code / terminal / dark-card surface — a structural anchor, not a fourth brand
hue. **No cool grays, no pure white, no pure black.**

**Fixed syntax colors (decoration, NOT remixable brand hues).** When a code line is hand-set rather
than rendered by a `code-*` block, keywords are coral, strings are **teal `#5DB8A6`**, numbers are
**amber `#E8A55A`**; status reads success `#5DB872` / warn `#C64545`. These track the code surface,
not the brand trinity — keep them out of the brand palette.

## Typography

Two ramps. The **reading/chrome ramp** (Onest `body` 1.5cqw / `lead` 2.08cqw weight 400; JetBrains
Mono `kicker`/`mono-label` in px) carries copy + chrome; the **display ramp** (Onest `headline` 4.6cqw
→ `display-cover` 9.9cqw, weight 400, negative-tracked) carries every headline + stat.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; mono px labels are chrome only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `display-cover`; 4–6 → `display`; 7+ → `headline`. Reserve the 7.3–9.9cqw tier for cover / statement / stat.
- **Onest display is sentence case** (NOT title case, NOT uppercase), weight 400, negative-tracked (−0.012..−0.028em); reach for **italic** when the line is a stance or a definition. **Onest body** sentence case weight 400. **JetBrains Mono** kickers UPPERCASE 0.16em with the coral ✱. No uppercase serif, no sans headline, no serif label.

## Depth & Surface

Hairline elevation:

- **1px hairline** ink border at ~12% alpha is the primary lift (cream@14% on navy).
- **One soft warm shadow** (`0 1px 3px ink@8%, 0 4px 16px ink@4%`) — used rarely, never heavy.
- **Half-step surface** — a `{colors.tile}` block on cream reads elevated by the warm step, not by a cast shadow.

**Ceiling:** no heavy drop shadow, no glow, no gradient on content, no tilt. The system has no light
to emit; it reads by warmth and hairline.

## Shapes

- **6px** small chrome, **8px** cards / code surface, **12px** large cards / quote frames, **9999px** true pills only. No square corners, no heavy rounding; the editorial register is gently rounded, never hard.

## Components

- **card-hairline** — the editorial content card (hairline + one soft shadow). **section-rule** — the only separator (1px, coral may draw on).
- **kicker-spike** — the ✱ coral eyebrow. **coral-callout** — the one voltage moment (CTA / inline link / full-bleed band).
- **number-lockup** — Onest figure + mono unit (the PR `+N / −M`, `200K`, file counts). **pull-quote** — Onest italic + cite (a commit message / reviewer line).
- **code-surface** — the warm-navy code / terminal surface; the code itself comes from the **`code-*` registry blocks**, this owns the surface + mono chrome.
- **spike-mark** — the ✱ brand glyph, always coral.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · Fixed/Free · density.
> One coral moment per frame; open with a kicker-spike.

### 1 · Cover (identity · move: oversized Onest · cream)

**Ground** `{colors.cream}`, `slide-pad`. **Composes** kicker-spike, display-cover, lead, mono-label index. **Focal** a 2–3 line Onest `display-cover` (sentence case, ink) under a coral ✱ kicker. **Chrome** mono index strip (repo · branch). **Accent** the single coral ✱. **Fixed** Onest 400 sentence case, hairline, cream ground. **Free** title, the mono index, layout + how full the frame runs. **Density** free.

### 2 · Statement (statement · move: single Onest line · cream or navy)

**Ground** `{colors.cream}` (or `{colors.navy}` for gravity). **Composes** kicker-spike, display, optional lead. **Focal** one 2-line Onest `display` carrying the change in a sentence — reach for **italic** if it's a stance. **Chrome** mono kicker. **Accent** none — the serif carries it (or one coral word). **Fixed** sentence-case serif. **Free** the line, ground, layout + density. **Density** free.

### 3 · Code Surface (code · move: warm-navy code window · the PR-critical frame)

**Ground** `{colors.cream}` framing a `{colors.navy}` **code-surface** (8px, cream@14% hairline, `navy-elev` title bar + filename in mono). **Composes** mono-label filename, the **`code-*` block** (code-diff / code-typing / code-snippet-_), optional `section-rule`. **Focal** the code panel — the diff / before→after / typed-on snippet. **Chrome** mono filename + status strip. **Accent** syntax coral/teal/amber inside the panel; one coral marker outside (e.g. a `+`/`−` gutter cue). **Fixed** warm-navy surface, mono code, hairline. **Free** which code-_ block, the code (from the diff), how large the panel runs. **Density** dense.

### 4 · Number / Impact (data · move: oversized figure · cream)

**Ground** `{colors.cream}`, `slide-pad`. **Composes** kicker-spike, number-lockup, lead/caption, optional `section-rule`. **Focal** a Onest `number-hero` figure with a mono unit over a 1px rule — the PR impact (`+1,204 / −318`, `17 files`, `2.1× faster`). **Chrome** mono tag. **Accent** the figure in ink; at most one coral unit. **Fixed** serif figure + mono unit, hairline rule. **Free** the figures (from the script), tag, layout + density. **Density** free.

### 5 · Pull-quote (quote · move: Onest italic · cream)

**Ground** `{colors.cream}`. **Composes** kicker-spike, pull-quote, tag-upper cite. **Focal** a Onest **italic** `quote-pull` — a commit message, a reviewer line, or the thesis — with a small Onest uppercase cite (author · role) beneath. **Chrome** mono kicker. **Accent** none, or one coral mark. **Fixed** Onest italic quote + uppercase cite. **Free** quote, attribution, layout + density. **Density** free.

### 6 · Closing / CTA (closer · move: coral voltage · cream or navy)

**Ground** `{colors.cream}` (or `{colors.navy}`). **Composes** display sign-off, coral-callout, optional contributor row (`assets/<login>.png` avatars + mono names). **Focal** a short Onest sign-off with the one **coral-callout** (the CTA or full-bleed band) and, for a "shipped-by" close, a row of hairline-ringed avatar chips. **Chrome** mono index. **Accent** the single coral voltage. **Fixed** one coral moment, hairline avatar rings, sentence-case serif. **Free** sign-off, who ships, layout + density. **Density** free.

## Composition Rules

### Do

- Stand every frame on the **warm cream floor**; gather content on a **half-step tile** surface.
- Set all display in **Onest, sentence case**, negative-tracked; **Onest 400** body; **JetBrains Mono** kickers (uppercase, 0.16em, coral ✱) + code.
- Ration **coral to one moment per frame** — CTA, inline link, OR full-bleed band.
- Elevate with a **1px hairline** + at most one soft warm shadow; reserve **warm navy** for the code/terminal surface.
- Lead with **one clear focal**; open regions with a **kicker-spike**. Fill the frame as the content wants.
- Pair a Onest figure with a **mono unit** for every stat; render code via the **`code-*` blocks** on the navy surface.

### Don't

- No pure white, no cool gray, no pure black; no fourth brand hue (navy is structural, syntax colors are decoration).
- No heavy drop shadow, glow, gradient on content, or tilt — hairline elevation only.
- No uppercase or title-case Onest display; no sans headline; no serif label; no serif-set numeric unit.
- No two coral moments in one frame; coral never sets a headline or body run.
- Don't blow a headline past the measure — step the ramp down.

## Aspect-Ratio Behavior

| Treatment     | 16:9                    | 9:16                        | 1:1                    |
| ------------- | ----------------------- | --------------------------- | ---------------------- |
| Cover         | display left, index top | display top, index below    | display, index corner  |
| Statement     | line left/centered      | line stacked                | centered               |
| Code Surface  | panel framed in cream   | panel taller, fewer lines   | panel centered, square |
| Number/Impact | figure left             | figure centered, taller     | centered               |
| Pull-quote    | quote left              | quote stacked               | centered               |
| Closing/CTA   | sign-off + avatar row   | sign-off top, avatars below | centered, avatars wrap |

`slide-pad` holds on the short edge; re-step display above the 1.4cqw floor. The code surface keeps
its hairline + mono chrome on every ratio; the avatar row wraps rather than shrinks below legibility.

## Approved Real Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. Contributor avatars come from the project's `assets/<login>.png` (staged from the PR's
people graph); the ✱ spike, hairlines, and the code surface are CSS-only and need no external imagery.

## Numerals & Claims (hard rule)

Never invent figures, stats, diffs, or counts at frame scale. Render slots as `— figure —`,
`{metric}`, `+N / −M`. Number-lockups, code panels, and impact stats carry placeholders until the
script (from the PR ingest) supplies real values. Branch names, file counts, and `+/−` totals trace
to the diff; commit/issue numbers are chrome.

## Pre-Render Self-Audit

- **Squint** — one Onest display moment dominates.
- **Trinity** — cream floor + tile step + ink voice; coral appears exactly once; warm navy only on the code surface; no cool gray / pure white / fourth hue.
- **Type** — Onest sentence-case display (negative-tracked); Onest 400 body; JetBrains Mono kickers (uppercase 0.16em, coral ✱) + code; ≥1.4cqw floor.
- **Depth** — 1px hairline + at most one soft warm shadow; no heavy drop / glow / gradient / tilt; 6/8/12px radii.
- **Code** — code rendered by a `code-*` block on the warm-navy surface; syntax coral/teal/amber; figures paired with a mono unit.
- **Fabrication** — every numeral / diff traces to the PR, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only. Code editorial's motion register — short cross-dissolves, no overshoot/bounce/elastic, coral the only "draw-on", numbers count up, code types on line by line — lives in the workflow's `motion-language.md` + `hyperframes-animation`, not here.
- **Onest + Onest + JetBrains Mono ship as licensed local WOFF2 assets with this preset.** `build-frame.mjs` stages weights 400 + 700 into `assets/fonts/` and appends the exact `@font-face` block to the generated `frame.md`, so Studio, snapshots, and renders resolve them offline without a first-run Google Fonts fetch. Author display at **weight 400** (700 reads as a heavy bold, off-register), and treat italic as the browser-synthesized slant (acceptable for the pull-quote register; add a real italic face only if a project leans hard on it). Onest is a warm old-style serif (low contrast, humanist); if it ever fails, fall to Georgia or another old-style serif — never to a sans. CJK: Noto Serif SC (display) / Noto Sans SC (body) / Noto Sans Mono CJK (code); the sentence-case warmth carries when the serif drops.
- **Syntax colors (teal `#5DB8A6` / amber `#E8A55A` / status) are fixed decoration**, declared in §Colors — they are NOT in the remixable `colors:` block, so a brand remix never repaints them.
- **The code itself is the `code-*` registry blocks**, not this preset — this preset owns only the surrounding warm-navy surface + mono chrome.
- **9:16 / 1:1 are guidance**; verify the legibility floor and that the cream/tile warmth + one-coral discipline hold per ratio.


## Font loading (auto-generated)

The brand font ships as local files in `assets/fonts/` — do NOT link Google Fonts for it. Paste this `<style>` into every frame's `<head>`/`<template>` (captions use the same files) so `font-family` resolves in preview, snapshot, and render alike:

```html
<style>
@font-face{font-family:Schibsted Grotesk;font-style:normal;font-weight:400 900;font-display:swap;src:url("assets/fonts/captured-56069e83bb5b2425-s.p.woff2") format("woff2");unicode-range:u+0100-02ba,u+02bd-02c5,u+02c7-02cc,u+02ce-02d7,u+02dd-02ff,u+0304,u+0308,u+0329,u+1d00-1dbf,u+1e00-1e9f,u+1ef2-1eff,u+2020,u+20a0-20ab,u+20ad-20c4,u+2113,u+2c60-2c7f,u+a720-a7ff}
@font-face{font-family:Schibsted Grotesk;font-style:normal;font-weight:400 900;font-display:swap;src:url("assets/fonts/captured-91601dd83defba07-s.p.woff2") format("woff2");unicode-range:u+00??,u+0131,u+0152-0153,u+02bb-02bc,u+02c6,u+02da,u+02dc,u+0304,u+0308,u+0329,u+2000-206f,u+20ac,u+2122,u+2191,u+2193,u+2212,u+2215,u+feff,u+fffd}
@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:400 700;font-display:block;src:url("assets/fonts/gf-jetbrainsmono-cyrillic-ext.woff2") format("woff2");unicode-range:U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F}
@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:400 700;font-display:block;src:url("assets/fonts/gf-jetbrainsmono-cyrillic.woff2") format("woff2");unicode-range:U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116}
@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:400 700;font-display:block;src:url("assets/fonts/gf-jetbrainsmono-latin-ext.woff2") format("woff2");unicode-range:U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF}
@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:400 700;font-display:block;src:url("assets/fonts/gf-jetbrainsmono-latin.woff2") format("woff2");unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:"Onest";font-style:normal;font-weight:400 900;font-display:block;src:url("assets/fonts/gf-onest-cyrillic-ext.woff2") format("woff2");unicode-range:U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F}
@font-face{font-family:"Onest";font-style:normal;font-weight:400 900;font-display:block;src:url("assets/fonts/gf-onest-cyrillic.woff2") format("woff2");unicode-range:U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116}
@font-face{font-family:"Onest";font-style:normal;font-weight:400 900;font-display:block;src:url("assets/fonts/gf-onest-latin-ext.woff2") format("woff2");unicode-range:U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF}
@font-face{font-family:"Onest";font-style:normal;font-weight:400 900;font-display:block;src:url("assets/fonts/gf-onest-latin.woff2") format("woff2");unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
</style>
```
