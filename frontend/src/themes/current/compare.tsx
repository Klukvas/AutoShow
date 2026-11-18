'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { catalogLabel } from '@/lib/catalog-label';
import { LeadForm } from '@/components/lead/lead-form';
import { MediaPicture } from '@/components/ui/media-picture';
import type { PublicListing } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import type { CompareRowView } from '@/lib/compare-rows';
import type { CompareState, Comparison } from '@/lib/storefront/compare-state';
import type { CompareProps } from '../contract';
import { CompareSkeleton } from './parts/compare-skeleton';
import { SavedCarsEmpty, SavedCarsLoadError } from './parts/saved-cars-states';

/**
 * The table to show, if any. A switch on purpose: a status this view does not know
 * must fail to compile instead of rendering an empty page.
 */
function comparisonToShow(state: CompareState): Comparison | null {
  switch (state.status) {
    case 'loading':
    case 'empty':
      return null;
    case 'ready':
    case 'error':
      return state.comparison;
    default:
      return state satisfies never;
  }
}

/**
 * Existing compare markup. Cars are shown as columns; specs as rows. A cell that
 * differs from the others in its row is emphasised so trade-offs pop, the
 * objectively best value (cheapest, newest…) is marked, and identical rows can
 * be hidden. A lead form below sends the whole shortlist to the manager.
 */
export function Compare({ model }: CompareProps) {
  const { t, state, retry, removeCar, setShowingOnlyDifferences } = model;
  const comparison = comparisonToShow(state);
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="mb-6 font-heading text-title-lg font-medium text-ink">{t('title')}</h1>

      {state.status === 'error' && (
        <SavedCarsLoadError
          message={t('loadError')}
          retryLabel={t('retry')}
          isRetrying={state.isRetrying}
          onRetry={retry}
          className="mb-6"
        />
      )}

      {state.status === 'loading' ? (
        <CompareSkeleton rowCount={state.rowCount} />
      ) : state.status === 'empty' ? (
        <SavedCarsEmpty message={t('empty')} catalogLabel={t('goCatalog')} className="mt-2" />
      ) : comparison ? (
        <>
          {comparison.canShowOnlyDifferences && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sub font-medium text-ink-2">
                <input
                  type="checkbox"
                  checked={comparison.isShowingOnlyDifferences}
                  onChange={(e) => setShowingOnlyDifferences(e.target.checked)}
                  className="focus-ring h-4 w-4 accent-[rgb(var(--accent))]"
                />
                {t('onlyDiff')}
              </label>
              <p className="text-[0.75rem] text-ink-3">
                <span aria-hidden className="text-ok">
                  ✓
                </span>{' '}
                {t('bestLegend')}
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th className="w-[120px] p-2" />
                  {comparison.cars.map((car) => (
                    <CarColumnHeader
                      key={car.id}
                      car={car}
                      removeLabel={t('remove')}
                      onRemove={removeCar}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((rowView) => (
                  <SpecRow
                    key={rowView.row.key}
                    label={t(`rows.${rowView.row.key}`)}
                    rowView={rowView}
                    cars={comparison.cars}
                    bestLabel={t('best')}
                  />
                ))}
              </tbody>
            </table>
            {comparison.rows.length === 0 && (
              <p className="p-2 text-sub text-ink-2">{t('noDiff')}</p>
            )}
          </div>
          <section className="mt-10 max-w-[640px]">
            <p className="mb-3 text-body-md text-ink-2">{t('leadIntro')}</p>
            <LeadForm messagePrefix={comparison.leadSummary} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function CarColumnHeader({
  car,
  removeLabel,
  onRemove,
}: {
  car: PublicListing;
  removeLabel: string;
  onRemove: (slug: string) => void;
}) {
  const locale = useLocale();
  const cover = car.media.find((m) => m.isCover) ?? car.media[0];
  return (
    <th className="p-2 align-top">
      <div className="flex flex-col gap-2">
        <Link
          href={`/cars/${car.slug}`}
          className="focus-ring relative block aspect-[4/3] overflow-hidden rounded-none border border-line bg-surface-2"
        >
          {cover ? <MediaPicture media={cover} alt={car.title} fill sizes="240px" /> : null}
        </Link>
        <Link
          href={`/cars/${car.slug}`}
          className="focus-ring text-left text-sub font-medium text-ink hover:text-lot-gold"
        >
          {catalogLabel(car.make, locale)} {catalogLabel(car.model, locale)}
        </Link>
        <button
          type="button"
          onClick={() => onRemove(car.slug)}
          className="focus-ring inline-flex h-9 items-center self-start rounded-chip px-2 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-danger"
        >
          {removeLabel}
        </button>
      </div>
    </th>
  );
}

function SpecRow({
  label,
  rowView,
  cars,
  bestLabel,
}: {
  label: string;
  rowView: CompareRowView;
  cars: readonly PublicListing[];
  bestLabel: string;
}) {
  const { values, best, uniform } = rowView;
  return (
    <tr className="border-t border-line/70">
      <th className="p-2 text-left text-[0.75rem] font-medium text-ink-3">{label}</th>
      {values.map((v, i) => {
        const isBest = best.includes(i);
        return (
          <td
            key={cars[i].id}
            className={cn(
              'p-2 text-sub tabular',
              isBest ? 'font-medium text-ok' : uniform ? 'text-ink-2' : 'font-medium text-ink',
            )}
          >
            {v}
            {isBest && (
              <>
                <span aria-hidden> ✓</span>
                <span className="sr-only"> — {bestLabel}</span>
              </>
            )}
          </td>
        );
      })}
    </tr>
  );
}
