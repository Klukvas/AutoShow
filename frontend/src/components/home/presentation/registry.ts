import type { PublicInstallation } from '@/lib/installation/config';
import { HomeView } from './home-view';
import {
  CinematicInventoryCard,
  DetailedInventoryCard,
  type InventoryCardComponent,
} from './inventory-card';

type Presentation = Readonly<{ Home: typeof HomeView; InventoryCard: InventoryCardComponent }>;
const presentations = {
  current: { Home: HomeView, InventoryCard: CinematicInventoryCard },
  compact: { Home: HomeView, InventoryCard: DetailedInventoryCard },
} satisfies Record<PublicInstallation['themeId'], Presentation>;

export function getStorefrontPresentation(theme: PublicInstallation['themeId']): Presentation {
  return presentations[theme];
}
