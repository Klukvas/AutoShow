# Unify the storefront tags label to "Ярлики"

Written against: unavailable — git operations are blocked in this environment (Xcode CLI license not accepted). Working tree is branch `feat/paper-lot-storefront`; re-derive the current commit once git works.

## Evidence chain

- Surface: `frontend/src/app/(public)/cars/[slug]/page.tsx` (route `/cars/[slug]`) — the tags section heading, contrasted with the tags filter facet on `/cars`.
- Problem: The tags feature is titled **"Позначки"** on the car detail page but **"Ярлики"** in every other user-facing place it appears (catalog filter facet, admin nav, admin dictionary screen, admin listing-form group). One concept, two Ukrainian words, inside the same browse task.
- Design evidence: User-facing copy is owned by the single-locale file `frontend/messages/uk.json` (Ukrainian is the only interface locale). `listing.tagsTitle: "Позначки"` (line ~178) diverges from `catalog.filter.tags: "Ярлики"` (line ~137), `admin.tags.title: "Ярлики"` (line ~731 — the feature's canonical dictionary name), `admin.nav.tags: "Ярлики"` (line ~268), and `admin.form.groupTags: "Ярлики (мультивибір)"` (line ~386). Established term is "Ярлики" (4 usages vs 1).
- Owner: `frontend/messages/uk.json`, key `listing.tagsTitle`.
- Scope and affected surfaces: the `/cars/[slug]` detail section heading only. `t('tagsTitle')` at `cars/[slug]/page.tsx:172` (`SectionHeading title={t('tagsTitle')}`, where the page's translator namespace is `listing`) is the sole consumer of this key.
- Uncertainty: none — the canonical term is fixed by the dictionary's own name (`admin.tags.title`) and by the same-task filter facet the user just interacted with.

## Design decision

Change the value of `listing.tagsTitle` from "Позначки" to "Ярлики". This makes the storefront use one consistent label for the tags concept across the browse task and matches the feature's canonical name. Fixing it at the copy owner (the locale file) resolves the root problem for every consumer, rather than overriding the string in the component.

## Reuse

- `frontend/messages/uk.json` → `catalog.filter.tags` = "Ярлики" (the term already shown to the user on `/cars`).
- Exemplar: `frontend/messages/uk.json` → `admin.tags.title` = "Ярлики" (the feature's canonical name).

No new primitive.

## Changes

1. `frontend/messages/uk.json`
   - Change: set the `listing.tagsTitle` value to `"Ярлики"` (currently `"Позначки"`, ~line 178). Keep the JSON key, ordering, and surrounding formatting intact.
   - Preserve: the key name `tagsTitle`; the component reference `t('tagsTitle')` at `cars/[slug]/page.tsx:172` (do not touch the component); all `catalog.*` and `admin.*` tag strings (already correct).
   - Verify: on `/cars/[slug]` for a listing with ≥1 tag, the section heading reads "Ярлики"; the `/cars` filter facet still reads "Ярлики" — the two are now identical.

## Scope

- Inherit: `/cars/[slug]` tags section heading (only consumer of `listing.tagsTitle`).
- Verify: `/cars` filter facet still reads "Ярлики" (unchanged; confirms parity).
- Exclude: the `?tags[]=` query-string key, tag slugs, and every code identifier — this is display copy only. Do not edit `catalog.filter.tags`, `admin.nav.tags`, `admin.form.groupTags`, or `admin.tags.title` (already the target term).

## Validation

- Product: open a car detail page that has tags (seeded example: `bmw-5-series-2021-demo`, which carries `obmin` + `urgent`). The labelled section reads "Ярлики" and matches the facet used on `/cars`.
- Interface: `/cars` (facet "Ярлики") and `/cars/[slug]` (heading "Ярлики"); single locale (uk), light and dark themes — copy is theme-independent.
- System: no other key should still read "Позначки" for this concept — `grep -n "Позначки" frontend/messages/uk.json` → no matches.
- Repository: `node -e "JSON.parse(require('fs').readFileSync('frontend/messages/uk.json','utf8')); console.log('valid')"` → prints `valid` (JSON still parses).

## Stop conditions

- Stop if a second locale file is introduced (the rename must then be applied per-locale, not just to `uk.json`).
- Stop if `listing.tagsTitle` gains another consumer that intends a deliberately distinct meaning from the filter/admin "Ярлики".

## Design documentation

- After acceptance and validation: none strictly required (no `DESIGN.md` governs copy). Optional: if a UI glossary is later created, record that the tags concept is labelled "Ярлики" storefront-wide.
