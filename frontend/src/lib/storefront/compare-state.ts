import type { Currency, PublicListing } from '@/lib/api/types';
import {
  COMPARE_ROWS,
  buildRowView,
  compareLeadSummary,
  type CompareRowView,
} from '@/lib/compare-rows';

/** The loaded cars side by side: one column per car, one row per spec. */
export type Comparison = Readonly<{
  cars: readonly PublicListing[];
  /** Rows to show: every spec, or only those where the cars differ. */
  rows: readonly CompareRowView[];
  /** False with a single car: every row is "the same" then, so there is nothing to hide. */
  canShowOnlyDifferences: boolean;
  isShowingOnlyDifferences: boolean;
  /** The compared cars as text, sent to the manager with the lead. */
  leadSummary: string;
}>;

/**
 * What the compare page shows. `error` means some cars could not be loaded (the saved
 * slugs are kept and a retry is offered); its `comparison` holds the cars that did load,
 * or null when none did.
 */
export type CompareState =
  | Readonly<{ status: 'loading'; rowCount: number }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'ready'; comparison: Comparison }>
  | Readonly<{ status: 'error'; comparison: Comparison | null; isRetrying: boolean }>;

function comparisonOf(
  cars: readonly PublicListing[],
  baseCurrency: Currency | undefined,
  isShowingOnlyDifferences: boolean,
  lead: { siteOrigin: string; heading: string },
): Comparison {
  const rows = COMPARE_ROWS.map((row) => buildRowView(row, cars, baseCurrency));
  const canShowOnlyDifferences = cars.length > 1;
  return {
    cars,
    // The toggle is hidden with one car, so a stale "only differences" must not blank the table.
    rows:
      isShowingOnlyDifferences && canShowOnlyDifferences
        ? rows.filter((row) => !row.uniform)
        : rows,
    canShowOnlyDifferences,
    isShowingOnlyDifferences,
    leadSummary: compareLeadSummary(cars, lead.siteOrigin, lead.heading),
  };
}

export function compareState(input: {
  /** Cars of the last finished load, minus removed columns; null until the first load finishes. */
  cars: readonly PublicListing[] | null;
  baseCurrency: Currency | undefined;
  hasLoadFailure: boolean;
  isLoading: boolean;
  isShowingOnlyDifferences: boolean;
  /** Read only once there are cars, i.e. after a client-side load: needs the browser's origin. */
  lead: () => { siteOrigin: string; heading: string };
}): CompareState {
  const { cars, baseCurrency, hasLoadFailure, isLoading, isShowingOnlyDifferences, lead } = input;
  if (cars === null) return { status: 'loading', rowCount: COMPARE_ROWS.length };

  const comparison =
    cars.length > 0 ? comparisonOf(cars, baseCurrency, isShowingOnlyDifferences, lead()) : null;
  // A failed load is never "empty": the cars may exist, they just did not arrive.
  if (hasLoadFailure) return { status: 'error', comparison, isRetrying: isLoading };
  return comparison ? { status: 'ready', comparison } : { status: 'empty' };
}
