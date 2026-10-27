import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FilterBar } from '@/components/filters/filter-bar';
import { CatalogNewBatchScroller } from '@/components/listing/catalog-new-batch-scroller';
import { ListingCard } from '@/components/listing/listing-card';
import { LoadMore } from '@/components/listing/load-more';
import { MakeLogoStrip } from '@/components/listing/make-logo-strip';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/lib/api/public';
import { getSiteBranding } from '@/lib/branding/resolve';
import type { ListingsQuery } from '@/lib/api/types';
import { carFiltersQuery, readCarFilters } from '@/lib/car-filter';
import {
  MAX_PAGES,
  mergePages,
  nextFanOut,
  readCursorStack,
  type CatalogListings,
  type CursorStack,
} from '@/lib/catalog-cursor';

export const revalidate = 30;

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(search: Record<string, string | string[] | undefined>): ListingsQuery {
  const get = (key: string) => firstValue(search[key]);
  const getAll = (key: string) => {
    const value = search[key];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };
  const getMany = (key: string) => {
    const values = getAll(`${key}[]`);
    const all = values.length > 0 ? values : getAll(key);
    return all.length > 0 ? all : undefined;
  };
  const num = (key: string) => {
    const v = get(key);
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Vehicle sets carry make, models and years — including old ?make=&yearMin=
  // links, which read as a single set.
  const cars = readCarFilters(getAll);

  return {
    q: get('q'),
    ...carFiltersQuery(cars),
    bodyType: get('bodyType'),
    fuelType: get('fuelType'),
    transmission: get('transmission'),
    driveType: get('driveType'),
    condition: get('condition') as ListingsQuery['condition'],
    city: get('city'),
    priceMin: num('priceMin'),
    priceMax: num('priceMax'),
    mileageMax: num('mileageMax'),
    options: getMany('options'),
    tags: getMany('tags'),
    sort: (get('sort') as ListingsQuery['sort']) ?? 'newest',
    cursor: get('cursor'),
    limit: 24,
  };
}

/**
 * Fetches every page of the stack in parallel — at most MAX_PAGES requests,
 * root and current cursor included. A failed page is NOT folded into an empty
 * page — the caller renders an explicit error state instead, so a down API can
 * never be mistaken for an honest zero-result filter.
 */
async function fetchListings(
  query: ListingsQuery,
  stack: CursorStack,
): Promise<CatalogListings> {
  try {
    // Accumulation always starts at the cursor-less root page; stack entries
    // and the current cursor are the subsequent chunks.
    const cursors: Array<string | undefined> = stack.accumulate
      ? [undefined, ...stack.cursors, ...(query.cursor ? [query.cursor] : [])]
      : query.cursor
        ? [query.cursor]
        : [undefined];
    if (cursors.length === 1) {
      return mergePages([
        await publicApi.listListings({ ...query, cursor: cursors[0] }, { revalidate: 30 }),
      ]);
    }
    const pages = await Promise.all(
      cursors.map((cursor) =>
        publicApi.listListings({ ...query, cursor }, { revalidate: 30 }),
      ),
    );
    return mergePages(pages);
  } catch {
    return { ok: false };
  }
}

/** Retry target: the current filters/cursor stack, so a reload is a real retry. */
function catalogHref(search: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  const qs = params.toString();
  return qs ? `/cars?${qs}` : '/cars';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog');
  return { title: t('title') };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const t = await getTranslations('catalog');
  const params = await searchParams;
  const query = buildQuery(params);
  const cursorStack = readCursorStack(params);
  // Hiding the button at the budget edge is what makes the cap safe: the
  // trail is never truncated on the user path (only crafted URLs are).
  const canLoadMore = nextFanOut(cursorStack, query.cursor) <= MAX_PAGES;
  // The brand strip highlights a make only when it is the whole selection.
  const onlyMake =
    query.car?.length === 1 && !query.car[0].includes(':') ? query.car[0] : undefined;

  const [
    listings,
    makes,
    models,
    bodyTypes,
    fuelTypes,
    transmissions,
    driveTypes,
    options,
    tags,
    branding,
  ] = await Promise.all([
    fetchListings(query, cursorStack),
    publicApi.listMakes().catch(() => []),
    publicApi.listModels(undefined).catch(() => []),
    publicApi.listSimpleCatalog('body-types').catch(() => []),
    publicApi.listSimpleCatalog('fuel-types').catch(() => []),
    publicApi.listSimpleCatalog('transmissions').catch(() => []),
    publicApi.listSimpleCatalog('drive-types').catch(() => []),
    publicApi.listOptions().catch(() => []),
    publicApi.listTags().catch(() => []),
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
      tags={tags}
      resultCount={listings.ok ? listings.total : undefined}
      baseCurrency={branding?.defaultCurrency}
    >
      {/*
        Permanently mounted (renders nothing): the scroll-to-new-batch effect
        must outlive `LoadMore`, which disappears on the final page.
      */}
      <CatalogNewBatchScroller />
      {listings.ok ? (
        <>
          <MakeLogoStrip makes={makes} activeMake={onlyMake} label={t('brands')} />
          {listings.items.length === 0 ? (
            <EmptyState
              title={t('emptyTitle')}
              body={t('emptyBody')}
              resetLabel={t('emptyReset')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {listings.items.map((listing, idx) => (
                <div
                  key={listing.id}
                  // Focus handoff target: the click that appends the last batch
                  // also removes the "load more" button, so focus would fall to
                  // <body>; the scroller moves it here instead (tabIndex -1
                  // makes the wrapper programmatically focusable, not tabbable,
                  // and the outline stays suppressed for that transfer).
                  tabIndex={-1}
                  // `min-w-0` lets the card's own `min-w-0`/truncation win
                  // inside `minmax(0,1fr)` grid tracks; without it the grid
                  // item's automatic minimum is the content width.
                  className="min-w-0 scroll-mt-header focus:outline-none"
                  data-catalog-new={idx === listings.newStartIndex ? 'true' : undefined}
                >
                  <ListingCard
                    listing={listing}
                    priority={idx < 3}
                    baseCurrency={branding?.defaultCurrency}
                  />
                </div>
              ))}
            </div>
          )}

          {listings.nextCursor && canLoadMore && (
            <div className="mt-10 flex justify-center">
              <LoadMore nextCursor={listings.nextCursor} />
            </div>
          )}
          {/*
            Budget reached too: the button is gone above, so this explains why
            the (source-wide) total cannot be reached instead of leaving the
            user with a silently truncated list.
          */}
          {listings.nextCursor && !canLoadMore && (
            <p role="status" className="mt-10 text-body-md text-ink-2">
              {t('limitNotice', { count: listings.items.length })}
            </p>
          )}
        </>
      ) : (
        <ErrorState
          title={t('errorTitle')}
          body={t('errorBody')}
          retryLabel={t('errorRetry')}
          retryHref={catalogHref(params)}
        />
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
      <h2 className="mt-5 font-heading text-section font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body-md text-ink-2">{body}</p>
      <Link
        href="/cars"
        className="focus-ring mt-6 inline-flex h-11 items-center rounded-input bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        {resetLabel}
      </Link>
    </div>
  );
}

/**
 * API failure state — same visual language as cars/error.tsx (danger square,
 * errorTitle/errorBody/errorRetry), but rendered inside the catalogue shell so
 * the user keeps their filters and can retry without losing context. A plain
 * anchor is intentional: it forces a fresh document/RSC request, bypassing
 * both the client router cache and a cached failure render.
 */
function ErrorState({
  title,
  body,
  retryLabel,
  retryHref,
}: {
  title: string;
  body: string;
  retryLabel: string;
  retryHref: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-input bg-danger-bg text-xl font-medium text-danger"
      >
        !
      </span>
      <h2 className="mt-5 font-heading text-section font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body-md text-ink-2">{body}</p>
      <Button as="a" variant="solid" className="mt-6" href={retryHref}>
        {retryLabel}
      </Button>
    </div>
  );
}
