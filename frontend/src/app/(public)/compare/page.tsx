'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MediaPicture } from '@/components/ui/media-picture';
import { publicApi } from '@/lib/api/public';
import { useCompare } from '@/lib/compare';
import { formatMoney, formatMileage, formatYear } from '@/lib/format';
import type { Branding, Currency, PublicListing } from '@/lib/api/types';

interface Row {
  key: string;
  value: (l: PublicListing, base?: Currency) => string;
}

const ROWS: Row[] = [
  {
    key: 'price',
    value: (l, base) =>
      base ? formatMoney(l.price.normalized, base) : formatMoney(l.price.amount, l.price.currency),
  },
  { key: 'year', value: (l) => formatYear(l.year) },
  { key: 'mileage', value: (l) => formatMileage(l.mileageKm) },
  { key: 'engine', value: (l) => `${l.engineVolumeL} л` },
  { key: 'power', value: (l) => `${l.powerHp} к.с.` },
  { key: 'body', value: (l) => l.bodyType?.nameUk ?? '—' },
  { key: 'fuel', value: (l) => l.fuelType?.nameUk ?? '—' },
  { key: 'transmission', value: (l) => l.transmission?.nameUk ?? '—' },
  { key: 'drive', value: (l) => l.driveType?.nameUk ?? '—' },
  { key: 'color', value: (l) => l.color?.nameUk ?? '—' },
  { key: 'owners', value: (l) => String(l.ownersCount) },
  { key: 'city', value: (l) => l.location.city },
];

/**
 * Guest compare view: slugs from localStorage, each car hydrated by slug so
 * data is current. Cars are shown as columns; specs as rows. A cell that
 * differs from the others in its row is emphasised so trade-offs pop.
 */
export default function ComparePage() {
  const t = useTranslations('compare');
  const { slugs, ready, remove } = useCompare();
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [base, setBase] = useState<Currency | undefined>(undefined);

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
        <h1 className="font-heading text-title-lg font-extrabold text-ink">{t('title')}</h1>
        <div className="mt-8 flex flex-col items-start gap-4">
          <p className="text-body-md text-ink-2">{t('empty')}</p>
          <Link
            href="/cars"
            className="focus-ring inline-flex h-11 items-center rounded-btn bg-accent px-5 text-sub font-bold text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t('goCatalog')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <h1 className="mb-6 font-heading text-title-lg font-extrabold text-ink">{t('title')}</h1>

      {items === null ? (
        <div className="h-[420px] animate-pulse rounded-card border border-line bg-surface" />
      ) : (
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
                          className="focus-ring relative block aspect-[4/3] overflow-hidden rounded-[10px] border border-line bg-surface-2"
                        >
                          {cover ? (
                            <MediaPicture media={cover} alt={l.title} fill sizes="240px" />
                          ) : null}
                        </Link>
                        <Link
                          href={`/cars/${l.slug}`}
                          className="focus-ring text-left text-sub font-bold text-ink hover:text-lot-gold"
                        >
                          {l.make.nameUk} {l.model.nameUk}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeColumn(l.slug)}
                          className="focus-ring self-start text-[12px] font-semibold text-ink-3 hover:text-danger"
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
              {ROWS.map((row) => {
                const values = items.map((l) => row.value(l, base));
                const allSame = values.every((v) => v === values[0]);
                return (
                  <tr key={row.key} className="border-t border-line/70">
                    <th className="p-2 text-left text-[12px] font-semibold text-ink-3">
                      {t(`rows.${row.key}`)}
                    </th>
                    {values.map((v, i) => (
                      <td
                        key={items[i].id}
                        className={
                          'p-2 text-sub tabular ' +
                          (allSame ? 'text-ink-2' : 'font-semibold text-ink')
                        }
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
