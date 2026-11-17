// Type-check and test entry only, never imported by app code (routes import
// `@theme/<slot>`): it fails `tsc` when this theme misses or mistypes a slot.
import type { StorefrontTheme, ThemeFontsOf } from '../contract';
import { About } from './about';
import { Catalog } from './catalog';
import { Collection } from './collection';
import { Compare } from './compare';
import { Contacts } from './contacts';
import { Favorites } from './favorites';
import type { fonts } from './fonts';
import { Home } from './home';
import { InventoryCard } from './inventory-card';
import { Listing } from './listing';
import { Shell } from './shell';

export const theme = {
  Shell,
  Home,
  Catalog,
  Collection,
  Listing,
  About,
  Contacts,
  Favorites,
  Compare,
  InventoryCard,
} as const satisfies StorefrontTheme;

// The same check for ./fonts, as a type: next/font cannot be evaluated outside a build.
export type Fonts = ThemeFontsOf<typeof fonts>;
