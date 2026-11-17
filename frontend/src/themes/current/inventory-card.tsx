import { ListingCard } from '@/components/listing/listing-card';
import type { InventoryCardProps } from '../contract';

export function InventoryCard(props: InventoryCardProps) {
  return <ListingCard {...props} variant="cinematic" />;
}
