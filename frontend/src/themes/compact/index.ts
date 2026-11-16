import type { StorefrontTheme } from '../contract';
import { currentTheme } from '../current';
import { DetailedInventoryCard } from './inventory-card';

export const compactTheme = {
  ...currentTheme,
  InventoryCard: DetailedInventoryCard,
} as const satisfies StorefrontTheme;
