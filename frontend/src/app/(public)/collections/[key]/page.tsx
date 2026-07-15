import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/listing/listing-card';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import { COLLECTIONS, collectionByKey, collectionCatalogHref } from '@/lib/collections';

interface PageProps {
  params: Promise<{ key: string }>;
}

export const revalidate = 300;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ key: c.key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const preset = collectionByKey(key);
  if (!preset) return {};
  return {
    title: preset.titleUk,
    description: preset.descriptionUk,
    alternates: { canonical: `/collections/${preset.key}` },
  };
}

/** Curated SEO landing: a filter preset with its own copy and URL. */
export default async function CollectionPage({ params }: PageProps) {
  const { key } = await params;
  const preset = collectionByKey(key);
  if (!preset) notFound();

  const [t, branding] = await Promise.all([getTranslations('catalog'), getSiteBranding()]);
  let items: Awaited<ReturnType<typeof publicApi.listListings>>['items'] = [];
  try {
    const page = await publicApi.listListings(
      { ...preset.query, sort: 'newest', limit: 24 },
      { revalidate: 300 },
    );
    items = page.items;
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8 md:px-8">
      <nav className="text-sub text-ink-3">
        <Link href="/" className="focus-ring rounded-[4px] hover:text-ink">
          AutoFlow
        </Link>
        {' / '}
        <Link href="/cars" className="focus-ring rounded-[4px] hover:text-ink">
          {t('title')}
        </Link>
      </nav>
      <h1 className="mt-3 font-heading text-title-lg font-extrabold text-ink">
        {preset.emoji} {preset.titleUk}
      </h1>
      <p className="mt-2 max-w-[620px] text-body-md leading-relaxed text-ink-2">
        {preset.descriptionUk}
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-body-md text-ink-2">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing, idx) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={idx < 3}
              baseCurrency={branding?.defaultCurrency}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <Button as="link" href={collectionCatalogHref(preset)} variant="outline" size="lg">
          {t('collectionAllFilters')} →
        </Button>
      </div>
    </div>
  );
}
