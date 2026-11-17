'use client';

import { useFavoritesModel } from '@/lib/storefront/use-favorites-model';
import { Favorites } from '@theme/favorites';

// A client page: the model is browser state (saved slugs, client-side loading) with
// callbacks, which a server component could not hand to the theme's view.
export default function FavoritesPage() {
  const model = useFavoritesModel();
  return <Favorites model={model} />;
}
