import { getTranslations } from 'next-intl/server';
import { ListingCard } from '@/components/listing/listing-card';
import { publicApi } from '@/lib/api/public';
import type { Currency, PublicListing } from '@/lib/api/types';

interface SimilarCarsProps {
  listing: PublicListing;
  baseCurrency?: Currency;
}

/**
 * "Схожі авто" — up to three cards of the same make (excluding the current
 * listing). Renders nothing when the catalog has no siblings.
 */
export async function SimilarCars({ listing, baseCurrency }: SimilarCarsProps) {
  const t = await getTranslations('listing');
  const page = await publicApi
    .listListings({ make: listing.make.slug, limit: 4 }, { revalidate: 60 })
    .catch(() => ({ items: [] as PublicListing[], nextCursor: null, total: undefined }));

  const similar = page.items.filter((item) => item.id !== listing.id).slice(0, 3);
  if (similar.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-section font-bold text-ink">{t('similarTitle')}</h2>
      <div className="mt-4 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((item) => (
          <ListingCard key={item.id} listing={item} baseCurrency={baseCurrency} />
        ))}
      </div>
    </section>
  );
}
