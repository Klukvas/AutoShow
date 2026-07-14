import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FilterBar } from '@/components/filters/filter-bar';
import { ListingCard } from '@/components/listing/listing-card';
import { LoadMore } from '@/components/listing/load-more';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import type { ListingsQuery } from '@/lib/api/types';

export const revalidate = 30;

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildQuery(search: Record<string, string | string[] | undefined>): ListingsQuery {
  const get = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const getMany = (key: string) => {
    const value = search[`${key}[]`] ?? search[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  };
  const num = (key: string) => {
    const v = get(key);
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // A model only makes sense scoped to its make — drop an orphaned model that
  // survived manual URL editing so the API never sees an inconsistent pair.
  const make = get('make');
  const model = make ? get('model') : undefined;

  return {
    q: get('q'),
    make,
    model,
    bodyType: get('bodyType'),
    fuelType: get('fuelType'),
    transmission: get('transmission'),
    driveType: get('driveType'),
    condition: get('condition') as ListingsQuery['condition'],
    city: get('city'),
    priceMin: num('priceMin'),
    priceMax: num('priceMax'),
    yearMin: num('yearMin'),
    yearMax: num('yearMax'),
    mileageMax: num('mileageMax'),
    options: getMany('options'),
    sort: (get('sort') as ListingsQuery['sort']) ?? 'newest',
    cursor: get('cursor'),
    limit: 24,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog');
  return { title: t('title') };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const t = await getTranslations('catalog');
  const query = buildQuery(await searchParams);

  const [page, makes, models, bodyTypes, fuelTypes, transmissions, driveTypes, options, branding] =
    await Promise.all([
      publicApi
        .listListings(query, { revalidate: 30 })
        .catch(() => ({ items: [], nextCursor: null, total: undefined })),
      publicApi.listMakes().catch(() => []),
      publicApi.listModels(undefined).catch(() => []),
      publicApi.listSimpleCatalog('body-types').catch(() => []),
      publicApi.listSimpleCatalog('fuel-types').catch(() => []),
      publicApi.listSimpleCatalog('transmissions').catch(() => []),
      publicApi.listSimpleCatalog('drive-types').catch(() => []),
      publicApi.listOptions().catch(() => []),
      getSiteBranding(),
    ]);

  return (
    <FilterBar
      title={t('title')}
      makes={makes}
      models={models}
      bodyTypes={bodyTypes as never}
      fuelTypes={fuelTypes as never}
      transmissions={transmissions as never}
      driveTypes={driveTypes as never}
      options={options}
      resultCount={page.total}
      baseCurrency={branding?.defaultCurrency}
    >
      {page.items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} resetLabel={t('emptyReset')} />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((listing, idx) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={idx < 3}
              baseCurrency={branding?.defaultCurrency}
            />
          ))}
        </div>
      )}

      {page.nextCursor && (
        <div className="mt-10 flex justify-center">
          <LoadMore nextCursor={page.nextCursor} />
        </div>
      )}
    </FilterBar>
  );
}

/** Handoff 1c "empty by filter": soft-square icon, title, hint, reset CTA. */
function EmptyState({
  title,
  body,
  resetLabel,
}: {
  title: string;
  body: string;
  resetLabel: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-input bg-bg text-xl text-ink-3"
      >
        ⌕
      </span>
      <h2 className="mt-5 font-heading text-section font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body-md text-ink-2">{body}</p>
      <Link
        href="/cars"
        className="focus-ring mt-6 inline-flex h-11 items-center rounded-input bg-accent px-5 text-sub font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        {resetLabel}
      </Link>
    </div>
  );
}
