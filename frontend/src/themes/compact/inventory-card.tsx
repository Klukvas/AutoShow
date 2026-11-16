import { ListingCard } from '@/components/listing/listing-card';
import type { InventoryCardProps } from '../contract';

/** Minimal alternate slot uses the existing catalogue card, with its deal metadata. */
export function DetailedInventoryCard(props: InventoryCardProps) {
  return <ListingCard {...props} variant="default" />;
}
