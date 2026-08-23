# Put the detail tag badge on the storefront chip-radius token

Written against: unavailable — git operations are blocked in this environment (Xcode CLI license not accepted). Working tree is branch `feat/paper-lot-storefront`; re-derive the current commit once git works.

## Evidence chain

- Surface: `frontend/src/app/(public)/cars/[slug]/page.tsx:177` — the tag badge `<li>` in the tags section on `/cars/[slug]`.
- Problem: The badge hardcodes `rounded-[3px]`, a radius absent from the storefront's editorial radius scale (2 / 4 / 5 / 6 / 7 / 8 / 12 px) and rounder than every other chip on the surface — including the sibling `StatusBadge` on the same page and the same tag badge on the card (`rounded-[2px]`).
- Design evidence: `.theme-vitrina-paper` defines "Editorial/print radius scale — crisp corners across the whole storefront" with `--radius-chip: 2px` (`frontend/src/styles/globals.css:231-232`). Tailwind maps `chip: 'var(--radius-chip)'` in `borderRadius` (`frontend/tailwind.config.*`, ~line 24), exposing the `rounded-chip` utility. The entire public subtree is wrapped in `theme-vitrina-paper` (`frontend/src/app/(public)/layout.tsx:17`), so the scale governs `/cars/[slug]`. Storefront chips already consume `rounded-chip` — e.g. `frontend/src/components/ui/status-badge.tsx`, `frontend/src/components/filters/active-chips.tsx`, `frontend/src/components/filters/filter-bar.tsx`.
- Owner: the `chip` radius token (`--radius-chip` → `rounded-chip`).
- Scope and affected surfaces: the detail tag badge only (`/cars/[slug]`). The card tag badge (`frontend/src/components/listing/listing-card.tsx:144`) already renders 2px (hardcoded `rounded-[2px]`).
- Uncertainty: none for the visual outcome (2px). Whether to also token-ify the card's hardcoded `rounded-[2px]` is optional hygiene with no visual change — see Scope.

## Design decision

Replace the off-scale `rounded-[3px]` on the detail tag badge with the storefront chip-radius token `rounded-chip` (2px). This puts the badge on the documented editorial radius scale, matches the sibling `StatusBadge` and the card's own tag badge, and references the token instead of a magic number. It is a presentation-only change; the badge's border, type, spacing, and content are unchanged.

## Reuse

- `rounded-chip` (Tailwind utility → `var(--radius-chip)`; resolves to 2px under `.theme-vitrina-paper`).
- Exemplar: `frontend/src/components/ui/status-badge.tsx` (a storefront badge already using `rounded-chip`).

No new primitive.

## Changes

1. `frontend/src/app/(public)/cars/[slug]/page.tsx` (the tag `<li>`, ~line 177)
   - Change: in the badge `className`, replace `rounded-[3px]` with `rounded-chip`. Leave the remaining classes untouched (`border border-line px-2.5 py-1 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-2`).
   - Preserve: border, typography, spacing, and badge content; the surrounding `<section>`/`<ul>` structure.
   - Verify: on `/cars/[slug]` the tag badges render with 2px corners, matching the `StatusBadge` corner radius on the same page and the card badges on `/cars`.

## Scope

- Inherit: `/cars/[slug]` tag badges.
- Verify: `/cars` card tag badges (`listing-card.tsx:144`) — already 2px; confirm both pages now match.
- Exclude: the card matte-photo frame `rounded-[3px]` (`listing-card.tsx`) — a different element with a legitimate radius; do not touch it. Optional, non-blocking hygiene: token-ify the card tag badge `rounded-[2px]` → `rounded-chip` (no visual change); not required by this finding, so keep it out unless doing a deliberate token sweep.

## Validation

- Product: browse to a car detail with tags (seeded `bmw-5-series-2021-demo`); the tag badges have the same crisp corners as the status badge and the card badges.
- Interface: `/cars/[slug]` in light and dark themes; render with 1 tag and with several tags; compare corner radius against the `/cars` card badges and the on-page `StatusBadge`.
- System: no new hardcoded radius introduced; the chip uses the `rounded-chip` token (no parallel radius pattern created).
- Repository: `grep -n "rounded-\[3px\]" "frontend/src/app/(public)/cars/[slug]/page.tsx"` → no matches after the change.

## Stop conditions

- Stop if `--radius-chip` is not 2px in the active storefront theme (then the badge should still follow the token, not a literal — but confirm the token itself is correct first).
- Stop if an accepted design source explicitly specifies a distinct radius for tag badges.

## Design documentation

- After acceptance and validation: none required — the governing decision (storefront chips use `rounded-chip` on the 2px editorial scale) is already documented in `frontend/src/styles/globals.css`.
