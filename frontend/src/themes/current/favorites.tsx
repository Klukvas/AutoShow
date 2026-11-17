'use client';

import { ListingCard } from '@/components/listing/listing-card';
import type { FavoritesProps } from '../contract';
import { placeholderCount } from './parts/favorites-placeholders';
import { SavedCarsEmpty, SavedCarsLoadError } from './parts/saved-cars-states';

/** Existing favorites markup: retry notice, loading placeholders, saved cars or the empty state. */
export function Favorites({ model }: FavoritesProps) {
  const { t, state, retry } = model;
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="font-heading text-title-lg font-medium text-ink">{t('title')}</h1>

      {state.status === 'error' && (
        <SavedCarsLoadError
          message={t('loadError')}
          retryLabel={t('retry')}
          isRetrying={state.isRetrying}
          onRetry={retry}
          className="mt-6"
        />
      )}

      {state.status === 'loading' ? (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: placeholderCount(state.savedCount) }, (_, i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : state.status === 'empty' ? (
        <SavedCarsEmpty message={t('empty')} catalogLabel={t('goCatalog')} className="mt-10" />
      ) : state.listings.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {state.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
