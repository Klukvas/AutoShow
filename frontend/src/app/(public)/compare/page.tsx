'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LeadForm } from '@/components/lead/lead-form';
import { MediaPicture } from '@/components/ui/media-picture';
import { cn } from '@/lib/cn';
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
 */
export default function ComparePage() {
  const t = useTranslations('compare');
  const { slugs, ready, remove } = useCompare();
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [base, setBase] = useState<Currency | undefined>(undefined);
  const [onlyDiff, setOnlyDiff] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (slugs.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [branding, ...results] = await Promise.all([
        publicApi.getBranding({ revalidate: 300 }).catch(() => null),
        ...slugs.map(async (slug) => {
          try {
            return await publicApi.getListingBySlug(slug, { revalidate: 0 });
          } catch {
            if (!cancelled) remove(slug); // prune a deleted/unpublished slug
            return null;
          }
        }),
      ]);
      if (cancelled) return;
      setBase((branding as Branding | null)?.defaultCurrency);
      setItems(results.filter((l): l is PublicListing => l !== null));
    })();
    return () => {
      cancelled = true;
    };
    // Not keyed on slugs: removing a column shouldn't refetch the whole grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Remove must drop the visible column too — `items` is intentionally not
  // keyed on `slugs`, so the context update alone wouldn't re-render the table.
  const removeColumn = (slug: string) => {
    remove(slug);
    setItems((prev) => prev?.filter((l) => l.slug !== slug) ?? prev);
  };

  if (items !== null && items.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-8">
        <h1 className="font-heading text-title-lg font-medium text-ink">{t('title')}</h1>
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-body-md text-ink-2">{t('empty')}</p>
          <Link
            href="/cars"
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t('goCatalog')}
          </Link>
        </div>
      </div>
    );
  }

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

      {items === null ? (
        <div className="h-[420px] animate-pulse rounded-card border border-line bg-surface" />
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
                            className="focus-ring self-start text-[0.75rem] font-medium text-ink-3 hover:text-danger"
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
