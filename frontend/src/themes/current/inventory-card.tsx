import { ListingCard } from '@/components/listing/listing-card';
import type { InventoryCardProps } from '../contract';

export function CinematicInventoryCard(props: InventoryCardProps) {
  return <ListingCard {...props} variant="cinematic" />;
}
