'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LeadForm } from '@/components/lead/lead-form';
import { MediaPicture } from '@/components/ui/media-picture';
import { cn } from '@/lib/cn';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { useCompare } from '@/lib/compare';
import { COMPARE_ROWS, buildRowView, compareLeadSummary } from '@/lib/compare-rows';
import type { Branding, Currency, PublicListing } from '@/lib/api/types';

/**
 * Guest compare view: slugs from localStorage, each car hydrated by slug so
 * data is current. Cars are shown as columns; specs as rows. A cell that
 * differs from the others in its row is emphasised so trade-offs pop, the
 * objectively best value (cheapest, newest…) is marked, and identical rows can
 * be hidden. A lead form below sends the whole shortlist to the manager.
 *
 * Only a car confirmed deleted (404) is pruned from storage; any other fetch
 * failure (500, timeout, offline) keeps the slug and offers a retry.
 */
export default function ComparePage() {
  const t = useTranslations('compare');
  const { slugs, ready, remove, removeMany } = useCompare();
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [base, setBase] = useState<Currency | undefined>(undefined);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    let failed = false;
    const pruned: string[] = [];
    const [branding, ...results] = await Promise.all([
      publicApi.getBranding({ revalidate: 300 }).catch(() => null),
      ...slugs.map(async (slug) => {
        try {
          return await publicApi.getListingBySlug(slug, { revalidate: 0 });
        } catch (err) {
          // Only a confirmed 404 means the car is gone: a 500, a timeout or an
          // offline tab must never erase a slug the guest explicitly compared.
          if (err instanceof ApiClientError && err.status === 404) {
            pruned.push(slug); // collect; the whole batch is pruned in one update
          } else {
            failed = true;
          }
          return null;
        }
      }),
    ]);
    return {
      branding: branding as Branding | null,
      list: results.filter((l): l is PublicListing => l !== null),
      pruned,
      failed,
    };
  }, [slugs]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { branding, list, pruned, failed } = await load();
      if (cancelled) return;
      setBase(branding?.defaultCurrency);
      setItems(list);
      setLoadFailed(failed);
      setLoading(false);
      // One functional update for the whole batch: prunes of deleted cars
      // compose instead of overwriting each other's stale snapshot. Nothing is
      // written after unmount.
      if (pruned.length > 0) removeMany(pruned);
    })();
    return () => {
      cancelled = true;
    };
    // Not keyed on slugs: removing a column shouldn't refetch the whole grid.
    // Re-running is an explicit user action — `attempt` bumps on "retry".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt]);

  // Remove must drop the visible column too — `items` is intentionally not
  // keyed on `slugs`, so the context update alone wouldn't re-render the table.
  const removeColumn = (slug: string) => {
    remove(slug);
    setItems((prev) => prev?.filter((l) => l.slug !== slug) ?? prev);
  };

  const loaded = items ?? [];
  const rows = COMPARE_ROWS.map((row) => buildRowView(row, loaded, base));
  // With one car every row is "uniform"; the toggle is hidden then, so a stale
  // `onlyDiff` must not blank the table.
  const canFilter = loaded.length > 1;
  const visibleRows = onlyDiff && canFilter ? rows.filter((r) => !r.uniform) : rows;
  // Rendered only after the client fetch resolves, so `window` is available.
  const leadSummary = loaded.length
    ? compareLeadSummary(loaded, window.location.origin, t('leadHeading'))
    : undefined;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="mb-6 font-heading text-title-lg font-medium text-ink">{t('title')}</h1>

      {loadFailed && (
        <div className="mb-6 flex flex-col items-start gap-4 rounded-card border border-danger-line bg-danger-bg p-4">
          <p role="alert" className="text-sub font-medium text-danger">
            {t('loadError')}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            disabled={loading}
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {items === null ? (
        <div className="overflow-x-auto" aria-hidden>
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th className="w-[120px] p-2" />
                {[0, 1, 2].map((column) => (
                  <th key={column} className="p-2 align-top">
                    <div className="flex flex-col gap-2">
                      <div className="aspect-[4/3] animate-pulse rounded-none border border-line bg-surface-2" />
                      <div className="h-[18px] w-3/4 animate-pulse rounded-chip bg-surface-2" />
                      <div className="h-9 w-16 animate-pulse rounded-chip bg-surface-2" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: COMPARE_ROWS.length }, (_, row) => (
                <tr key={row} className="border-t border-line/70">
                  <th className="p-2 text-left">
                    <div className="h-3.5 w-16 animate-pulse rounded-chip bg-surface-2" />
                  </th>
                  {[0, 1, 2].map((column) => (
                    <td key={column} className="p-2">
                      <div className="h-4 w-24 animate-pulse rounded-chip bg-surface-2" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        loadFailed ? null : (
          <div className="mt-2 flex flex-col items-start gap-4">
            <p className="text-body-md text-ink-2">{t('empty')}</p>
            <Link
              href="/cars"
              className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              {t('goCatalog')}
            </Link>
          </div>
        )
      ) : (
        <>
          {canFilter && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sub font-medium text-ink-2">
                <input
                  type="checkbox"
                  checked={onlyDiff}
                  onChange={(e) => setOnlyDiff(e.target.checked)}
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
                  {items.map((l) => {
                    const cover = l.media.find((m) => m.isCover) ?? l.media[0];
                    return (
                      <th key={l.id} className="p-2 align-top">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/cars/${l.slug}`}
                            className="focus-ring relative block aspect-[4/3] overflow-hidden rounded-none border border-line bg-surface-2"
                          >
                            {cover ? (
                              <MediaPicture media={cover} alt={l.title} fill sizes="240px" />
                            ) : null}
                          </Link>
                          <Link
                            href={`/cars/${l.slug}`}
                            className="focus-ring text-left text-sub font-medium text-ink hover:text-lot-gold"
                          >
                            {l.make.nameUk} {l.model.nameUk}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeColumn(l.slug)}
                            className="focus-ring inline-flex h-9 items-center self-start rounded-chip px-2 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-danger"
                          >
                            {t('remove')}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ row, values, best, uniform }) => (
                  <tr key={row.key} className="border-t border-line/70">
                    <th className="p-2 text-left text-[0.75rem] font-medium text-ink-3">
                      {t(`rows.${row.key}`)}
                    </th>
                    {values.map((v, i) => {
                      const isBest = best.includes(i);
                      return (
                        <td
                          key={items[i].id}
                          className={cn(
                            'p-2 text-sub tabular',
                            isBest
                              ? 'font-medium text-ok'
                              : uniform
                                ? 'text-ink-2'
                                : 'font-medium text-ink',
                          )}
                        >
                          {v}
                          {isBest && (
                            <>
                              <span aria-hidden> ✓</span>
                              <span className="sr-only"> — {t('best')}</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 && <p className="p-2 text-sub text-ink-2">{t('noDiff')}</p>}
          </div>
          <section className="mt-10 max-w-[640px]">
            <p className="mb-3 text-body-md text-ink-2">{t('leadIntro')}</p>
            <LeadForm messagePrefix={leadSummary} />
          </section>
        </>
      )}
    </div>
  );
}
