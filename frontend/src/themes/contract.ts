import type { ComponentProps, ComponentType, ReactNode } from 'react';
import type { ListingCard } from '@/components/listing/listing-card';
import type { Branding } from '@/lib/api/types';
import type { AboutModel } from '@/lib/storefront/about-model';
import type { CatalogModel } from '@/lib/storefront/catalog-model';
import type { CollectionModel } from '@/lib/storefront/collection-model';
import type { ContactsModel } from '@/lib/storefront/contacts-model';
import type { HomeModel } from '@/lib/storefront/home-model';
import type { ListingModel } from '@/lib/storefront/listing-model';
import type { CompareModel } from '@/lib/storefront/use-compare-model';
import type { FavoritesModel } from '@/lib/storefront/use-favorites-model';

export type InventoryCardProps = Omit<ComponentProps<typeof ListingCard>, 'variant'>;
export type InventoryCardComponent = ComponentType<InventoryCardProps>;

/** The storefront frame around every public page; state providers wrap it from the layout. */
export type ShellProps = { branding: Branding | null; children: ReactNode };
export type HomeProps = { model: HomeModel; InventoryCard: InventoryCardComponent };
export type CatalogProps = { model: CatalogModel };
export type CollectionProps = { model: CollectionModel };
export type ListingProps = { model: ListingModel };
export type AboutProps = { model: AboutModel };
export type ContactsProps = { model: ContactsModel };
/**
 * Favorites and Compare live in the browser (saved slugs, client-side loading), so their
 * model comes from a hook and carries callbacks: see `clientSlots`.
 */
export type FavoritesProps = { model: FavoritesModel };
export type CompareProps = { model: CompareModel };

/**
 * Blocks a theme may replace. Themes receive an already-fetched model and only
 * render it, so every client shares the same data, permissions and car logic.
 */
export type StorefrontTheme = Readonly<{
  Shell: ComponentType<ShellProps>;
  Home: ComponentType<HomeProps>;
  Catalog: ComponentType<CatalogProps>;
  Collection: ComponentType<CollectionProps>;
  Listing: ComponentType<ListingProps>;
  About: ComponentType<AboutProps>;
  Contacts: ComponentType<ContactsProps>;
  Favorites: ComponentType<FavoritesProps>;
  Compare: ComponentType<CompareProps>;
  InventoryCard: InventoryCardComponent;
}>;

/**
 * The slots that are Client Components. Their page is a `'use client'` module that builds
 * the model in the browser and renders the slot, so the slot's module is client code
 * whether or not it repeats the directive.
 *
 * Every other slot is a Server Component, and its module — a re-export file included —
 * must not be a `'use client'` module. The page slots get a model that holds functions
 * (the next-intl translator; Home also a component), which Next refuses to pass to a
 * Client Component — when the page is requested, after `tsc` and `next build` have
 * passed. Shell and InventoryCard would survive that, but would turn the frame and the
 * cards of every page into browser code. A server slot keeps its interactive pieces in
 * client components that it renders with plain data.
 */
export const clientSlots = [
  'Favorites',
  'Compare',
] as const satisfies readonly (keyof StorefrontTheme)[];

/**
 * File of each slot inside a theme folder; the slot is its same-named export.
 * The theme is chosen at build time (`STOREFRONT_THEME`, see next.config.mjs), and
 * routes import a slot as `@theme/<file>`, so every theme folder must contain every
 * file — a slot a theme does not redesign is a one-line re-export from another theme.
 * One module per slot keeps each route's bundle to the slots it renders.
 * Every sub-folder of `src/themes/` is a theme (its name is the `STOREFRONT_THEME`
 * value); helpers of a theme live in its own sub-folders, shared code outside `themes/`.
 */
export const slotModules = {
  Shell: 'shell',
  Home: 'home',
  Catalog: 'catalog',
  Collection: 'collection',
  Listing: 'listing',
  About: 'about',
  Contacts: 'contacts',
  Favorites: 'favorites',
  Compare: 'compare',
  InventoryCard: 'inventory-card',
} as const satisfies Readonly<Record<keyof StorefrontTheme, string>>;

/**
 * A non-slot module of a theme folder: it exports the folder's own name as
 * `themeId`. Only built-theme.ts imports it (`@theme/id`), to check that the bundle
 * contains the theme the build asked for; app code reads `builtThemeId` instead.
 */
export const themeIdModule = 'id';

/** What `next/font` returns, as far as the storefront uses it. */
export type ThemeFont = Readonly<{ style: Readonly<{ fontFamily: string }> }>;

/**
 * The font of each role, loaded with `next/font` in the theme's own module so that an
 * image carries only its theme's font files. `null` keeps the app font of that role
 * (src/lib/fonts.ts): `sans` is text and UI (`--font-sans`), `display` is headings and
 * numerals (`--font-display`).
 */
export type ThemeFonts = Readonly<{ sans: ThemeFont | null; display: ThemeFont | null }>;

/**
 * Compile-time check for a theme's index.ts: `ThemeFontsOf<typeof fonts>` fails `tsc`
 * when its fonts module does not follow the contract. A type, because `next/font` only
 * runs inside a Next build, so the tests cannot import a fonts module that uses it.
 */
export type ThemeFontsOf<Fonts extends ThemeFonts> = Fonts;

/** Non-slot module of a theme folder that exports its `fonts`; read as `@theme/fonts`. */
export const themeFontsModule = 'fonts';

/**
 * Stylesheet of a theme folder with its design tokens: the custom properties of
 * src/styles/globals.css and cinematic.css (colours, radii, shadow colour) it replaces,
 * for light and dark. The public layout imports it as `@theme/tokens.css`, so every
 * folder has one; a theme that keeps the shared look leaves it without rules.
 */
export const themeTokensStylesheet = 'tokens.css';

/**
 * The format of a theme id, i.e. of a folder name in `src/themes/`: the one
 * .github/workflows/release.yml accepts for STOREFRONT_THEME, so a folder named
 * otherwise could be built locally but never released.
 */
export const THEME_ID_FORMAT = /^[a-z][a-z0-9-]{0,62}$/;

/**
 * The visitor's colour mode: `data-theme` on `<html>`, set before first paint on every
 * storefront page (the 404 of an unknown collection is served without it).
 */
export type ColourMode = 'light' | 'dark';

/**
 * Selector of the storefront of one theme, in both colour modes or in one: the `<body>`
 * of a page that renders the public layout, whose wrapper carries `data-storefront-theme`.
 * Tokens and fonts are set there and not on the wrapper for three reasons: `<body>` is
 * where cinematic.css declares the shared tokens, so a wrapper could not replace them
 * for UI portaled out of it (the mobile menu); `font-family` is inherited as a computed
 * value from `<body>`; and an admin page has no wrapper, so nothing here can match it.
 *
 * `:root` is there for its weight. The strongest shared rule that declares tokens on
 * `<body>` is `[data-theme='light'] .platform-cinematic` (0,2,0); `body:has([…])` alone
 * is (0,1,1) and would lose to it in light mode only, while `:root body:has([…])` is
 * (0,2,1) and wins in both. theme-folders.test.ts derives that from the shared CSS.
 */
export function storefrontScope(themeId: string, mode?: ColourMode): string {
  if (!THEME_ID_FORMAT.test(themeId)) {
    throw new Error(`Not a storefront theme id: ${JSON.stringify(themeId)}`);
  }
  const page = mode ? `:root[data-theme='${mode}']` : ':root';
  return `${page} body:has([data-storefront-theme='${themeId}'])`;
}
