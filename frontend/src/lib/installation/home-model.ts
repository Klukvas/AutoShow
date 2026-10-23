import { getTranslations } from 'next-intl/server';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import { getInstallation } from './server';

/** Fetch and derive the same storefront model before selecting any presentation. */
export async function getHomeModel() {
  const installation = await getInstallation();
  const [t, branding, listings, collections, reviews, packages] = await Promise.all([
    getTranslations('home'),
    getSiteBranding(),
    publicApi
      .listListings({ sort: 'newest', limit: 7 }, { revalidate: 60 })
      .then((page) => page.items)
      .catch(() => []),
    publicApi.listCollections().catch(() => []),
    installation.features.reviews
      ? publicApi.listReviews({ revalidate: 300 }).catch(() => [])
      : Promise.resolve([]),
    publicApi.listPlacementPackages({ revalidate: 60 }).catch(() => []),
  ]);

  return {
    installation,
    t,
    branding,
    hero: listings[0] ?? null,
    inventory: listings.slice(0, 6),
    collections,
    reviews,
    packages,
  };
}
export type HomeModel = Awaited<ReturnType<typeof getHomeModel>>;
