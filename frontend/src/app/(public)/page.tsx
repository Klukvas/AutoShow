import { getHomeModel } from '@/lib/installation/home-model';
import { getStorefrontPresentation } from '@/components/home/presentation/registry';

export const revalidate = 60;

export default async function HomePage() {
  const model = await getHomeModel();
  const { Home, InventoryCard } = getStorefrontPresentation(model.installation.themeId);
  return <Home model={model} InventoryCard={InventoryCard} />;
}
