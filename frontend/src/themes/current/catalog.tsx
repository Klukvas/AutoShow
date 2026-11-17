import { FilterBar } from '@/components/filters/filter-bar';
import { CatalogNewBatchScroller } from '@/components/listing/catalog-new-batch-scroller';
import { ListingCard } from '@/components/listing/listing-card';
import { LoadMore } from '@/components/listing/load-more';
import { MakeLogoStrip } from '@/components/listing/make-logo-strip';
import type { Currency, PublicListing } from '@/lib/api/types';
import type { CatalogProps } from '../contract';
import { CatalogEmptyState, CatalogErrorState } from './parts/catalog-states';

/** Existing catalogue markup: filter rail plus the results column. */
export function Catalog({ model }: CatalogProps) {
  const { t, filters, baseCurrency, resultCount, activeMake, results } = model;
  const continuation = results.status === 'error' ? null : results.continuation;
  return (
    <FilterBar
      title={t('title')}
      makes={filters.makes}
      models={filters.models}
      bodyTypes={filters.bodyTypes}
      fuelTypes={filters.fuelTypes}
      transmissions={filters.transmissions}
      driveTypes={filters.driveTypes}
      options={filters.options}
      tags={filters.tags}
      resultCount={resultCount}
      baseCurrency={baseCurrency}
    >
      {/*
        Permanently mounted (renders nothing): the scroll-to-new-batch effect
        must outlive `LoadMore`, which disappears on the final page.
      */}
      <CatalogNewBatchScroller />
      {results.status === 'error' ? (
        <CatalogErrorState
          title={t('errorTitle')}
          body={t('errorBody')}
          retryLabel={t('errorRetry')}
          retryHref={results.retryHref}
        />
      ) : (
        <>
          <MakeLogoStrip makes={filters.makes} activeMake={activeMake} label={t('brands')} />
          {results.status === 'empty' ? (
            <CatalogEmptyState
              title={t('emptyTitle')}
              body={t('emptyBody')}
              resetLabel={t('emptyReset')}
            />
          ) : (
            <CatalogGrid
              items={results.items}
              newStartIndex={results.newStartIndex}
              baseCurrency={baseCurrency}
            />
          )}
          {continuation && continuation.kind === 'load-more' && (
            <div className="mt-10 flex justify-center">
              <LoadMore nextCursor={continuation.nextCursor} />
            </div>
          )}
          {/*
            Budget reached too: the button is gone above, so this explains why
            the (source-wide) total cannot be reached instead of leaving the
            user with a silently truncated list.
          */}
          {continuation && continuation.kind === 'limit-reached' && (
            <p role="status" className="mt-10 text-body-md text-ink-2">
              {t('limitNotice', { count: continuation.shownCount })}
            </p>
          )}
        </>
      )}
    </FilterBar>
  );
}

function CatalogGrid({
  items,
  newStartIndex,
  baseCurrency,
}: {
  items: readonly PublicListing[];
  newStartIndex: number | null;
  baseCurrency: Currency | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
      {items.map((listing, idx) => (
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
          data-catalog-new={idx === newStartIndex ? 'true' : undefined}
        >
          <ListingCard listing={listing} priority={idx < 3} baseCurrency={baseCurrency} />
        </div>
      ))}
    </div>
  );
}
