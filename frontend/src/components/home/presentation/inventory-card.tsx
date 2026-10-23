import type { ComponentProps, ComponentType } from 'react';
import { ListingCard } from '@/components/listing/listing-card';

type InventoryCardProps = Omit<ComponentProps<typeof ListingCard>, 'variant'>;
export type InventoryCardComponent = ComponentType<InventoryCardProps>;

export function CinematicInventoryCard(props: InventoryCardProps) {
  return <ListingCard {...props} variant="cinematic" />;
}

/** Minimal alternate slot uses the existing catalogue card, with its deal metadata. */
export function DetailedInventoryCard(props: InventoryCardProps) {
  return <ListingCard {...props} variant="default" />;
}
