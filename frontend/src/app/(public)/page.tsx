import { getHomeModel } from '@/lib/installation/home-model';
import { getTheme } from '@/themes/registry';

export const revalidate = 60;

export default async function HomePage() {
  const model = await getHomeModel();
  const { Home, InventoryCard } = getTheme(model.installation.themeId);
  return <Home model={model} InventoryCard={InventoryCard} />;
}
