import type { StorefrontTheme } from '../contract';
import { HomeView } from './home-view';
import { CinematicInventoryCard } from './inventory-card';

export const currentTheme = {
  Home: HomeView,
  InventoryCard: CinematicInventoryCard,
} as const satisfies StorefrontTheme;
