import type { ComponentProps, ComponentType } from 'react';
import type { ListingCard } from '@/components/listing/listing-card';
import type { HomeModel } from '@/lib/installation/home-model';

export type InventoryCardProps = Omit<ComponentProps<typeof ListingCard>, 'variant'>;
export type InventoryCardComponent = ComponentType<InventoryCardProps>;

export type HomeProps = { model: HomeModel; InventoryCard: InventoryCardComponent };
export type HomeComponent = ComponentType<HomeProps>;

/**
 * Blocks a theme may replace. Themes receive an already-fetched model and only
 * render it, so every client shares the same data, permissions and car logic.
 */
export type StorefrontTheme = Readonly<{
  Home: HomeComponent;
  InventoryCard: InventoryCardComponent;
}>;
