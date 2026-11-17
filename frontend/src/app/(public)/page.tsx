import { getHomeModel } from '@/lib/storefront/home-model';
import { Home } from '@theme/home';
import { InventoryCard } from '@theme/inventory-card';

export const revalidate = 60;

export default async function HomePage() {
  const model = await getHomeModel();
  return <Home model={model} InventoryCard={InventoryCard} />;
}
