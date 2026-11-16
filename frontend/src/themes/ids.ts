/**
 * Every id is a folder in this directory (`frontend/src/themes/`) and a value of the
 * backend enum `StorefrontTheme` in `src/config/env.validation.ts` at the repo root
 * (not the frontend contract type of the same name). Tests on both sides enforce it,
 * so the deploy-time `STOREFRONT_THEME` always has a shipped design. Every sub-folder
 * is therefore a theme: there is no `shared/` folder; helpers live in files directly
 * in this directory or outside it, and a theme may reuse another theme's blocks by
 * importing them (as compact does with current).
 */
export const themeIds = ['current', 'compact'] as const;
export type ThemeId = (typeof themeIds)[number];
