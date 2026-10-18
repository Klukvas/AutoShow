'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { FilterChip } from '@/components/ui/filter-chip';
import { Eyebrow } from '@/components/ui/eyebrow';
import { ActiveChipsRow, type ActiveFilter } from '@/components/filters/active-chips';
import { FilterSheet } from '@/components/filters/filter-sheet';
import { CarSetsField } from '@/components/filters/car-sets-field';
import { RangeField, SearchField, SelectField } from '@/components/filters/filter-fields';
import {
  carFiltersPatch,
  readCarFilters,
  type CarExclusion,
  type CarFilters,
  type CarSet,
} from '@/lib/car-filter';
import { formatMileage, formatMoney } from '@/lib/format';
import type {
  CatalogMake,
  CatalogModel,
  CatalogRef,
  CatalogTag,
  Currency,
  VehicleOption,
} from '@/lib/api/types';

interface FilterBarProps {
  makes: CatalogMake[];
  models: CatalogModel[];
  bodyTypes: CatalogRef[];
  fuelTypes: CatalogRef[];
  transmissions: CatalogRef[];
  driveTypes: CatalogRef[];
  options: VehicleOption[];
  tags: CatalogTag[];
  resultCount?: number;
  baseCurrency?: Currency;
  /** Catalog H1 (rendered inside the results column per handoff 1a). */
  title: string;
  /** Results content (grid + load more) — stays RSC, passed through. */
  children: React.ReactNode;
}

const SORT_VALUES = [
  'newest',
  'price_asc',
  'price_desc',
  'year_desc',
  'year_asc',
  'mileage_asc',
] as const;
const CONDITIONS = ['new', 'used', 'damaged'] as const;

/**
 * Catalog shell per handoff 1a/1b. Everything lives in the URL — the RSC
 * re-renders with the new searchParams and we soft-push inside a transition.
 * Desktop: 288px filter rail + results column (title, live count, sort,
 * removable chips, grid). Mobile: full-width search, "Фільтри" button with an
 * active-count badge + sort, scrollable chips, bottom sheet with a sticky
 * "Показати N авто" apply button.
 */
export function FilterBar({
  makes,
  models,
  bodyTypes,
  fuelTypes,
  transmissions,
  driveTypes,
  options,
  tags,
  resultCount,
  baseCurrency,
  title,
  children,
}: FilterBarProps) {
  const t = useTranslations('catalog');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currency: Currency = baseCurrency ?? 'USD';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'UAH' ? '₴' : '$';

  const current = (key: string) => searchParams.get(key) ?? undefined;
  const currentArray = (key: string) => searchParams.getAll(`${key}[]`);
  const currentSort = current('sort') ?? 'newest';

  const update = (patch: Record<string, string | string[] | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    // Reset cursor whenever a filter changes — the keyset only makes sense
    // for the exact filter combo it was generated from.
    next.delete('cursor');
    for (const [key, value] of Object.entries(patch)) {
      if (Array.isArray(value)) {
        // Hand-written links may use the bare key (?car=bmw, ?tags=x); drop it too.
        next.delete(key);
        next.delete(`${key}[]`);
        value.forEach((v) => next.append(`${key}[]`, v));
      } else if (value == null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    startTransition(() => {
      router.push(`/cars${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
    });
  };

  const toggleOption = (slug: string) => {
    const cur = currentArray('options');
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
    update({ options: next });
  };

  const toggleTag = (slug: string) => {
    const cur = currentArray('tags');
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
    update({ tags: next });
  };

  const resetAll = () => {
    startTransition(() => router.push('/cars', { scroll: false }));
  };

  const carFilters = readCarFilters((key) => searchParams.getAll(key));
  const updateCars = (next: CarFilters) => update(carFiltersPatch(next));

  // --- Derived option lists ------------------------------------------------
  const conditionOptions = CONDITIONS.map((c) => ({ label: t(`condition.${c}`), value: c }));

  const nameOf = (refs: CatalogRef[], slug: string) =>
    refs.find((r) => r.slug === slug)?.nameUk ?? slug;

  // --- Active-filter summary ----------------------------------------------
  const active: ActiveFilter[] = [];
  const q = current('q');
  if (q)
    active.push({
      id: 'q',
      label: `${t('search.label')}: “${q}”`,
      onRemove: () => update({ q: undefined }),
    });
  const yearsLabel = (set: CarSet) => {
    if (set.yearFrom != null && set.yearTo != null) return `${set.yearFrom}–${set.yearTo}`;
    if (set.yearFrom != null) return `${t('from')} ${set.yearFrom}`;
    if (set.yearTo != null) return `${t('to')} ${set.yearTo}`;
    return null;
  };
  const vehicleLabel = (make: string | undefined, modelSlugs: string[]) =>
    [make ? nameOf(makes, make) : null, modelSlugs.map((m) => nameOf(models, m)).join(', ')]
      .filter(Boolean)
      .join(' ');
  carFilters.sets.forEach((set, idx) => {
    active.push({
      id: `car:${idx}`,
      label: [vehicleLabel(set.make, set.models), yearsLabel(set)].filter(Boolean).join(' · '),
      onRemove: () =>
        updateCars({ ...carFilters, sets: carFilters.sets.filter((_, i) => i !== idx) }),
    });
  });
  carFilters.exclusions.forEach((exclusion: CarExclusion, idx) => {
    active.push({
      id: `exclude:${idx}`,
      label: `${t('carSets.excludeChip')} ${vehicleLabel(exclusion.make, exclusion.models)}`,
      onRemove: () =>
        updateCars({
          ...carFilters,
          exclusions: carFilters.exclusions.filter((_, i) => i !== idx),
        }),
    });
  });
  const refFacets: Array<[string, CatalogRef[]]> = [
    ['bodyType', bodyTypes],
    ['fuelType', fuelTypes],
    ['transmission', transmissions],
    ['driveType', driveTypes],
  ];
  for (const [key, refs] of refFacets) {
    const v = current(key);
    if (v)
      active.push({
        id: key,
        label: nameOf(refs, v),
        onRemove: () => update({ [key]: undefined }),
      });
  }
  const cond = current('condition');
  if (cond)
    active.push({
      id: 'condition',
      label: t(`condition.${cond}`),
      onRemove: () => update({ condition: undefined }),
    });
  const city = current('city');
  if (city)
    active.push({
      id: 'city',
      label: city,
      onRemove: () => update({ city: undefined }),
    });

  const priceMin = current('priceMin');
  const priceMax = current('priceMax');
  if (priceMin || priceMax)
    active.push({
      id: 'price',
      label: [
        priceMin ? formatMoney(priceMin, currency) : null,
        priceMax ? formatMoney(priceMax, currency) : null,
      ]
        .filter(Boolean)
        .join(' – '),
      onRemove: () => update({ priceMin: undefined, priceMax: undefined }),
    });
  const mileageMax = current('mileageMax');
  if (mileageMax)
    active.push({
      id: 'mileageMax',
      label: `${t('filter.mileageMax')} ${formatMileage(Number(mileageMax))}`,
      onRemove: () => update({ mileageMax: undefined }),
    });
  for (const slug of currentArray('options')) {
    active.push({
      id: `opt:${slug}`,
      label: options.find((o) => o.slug === slug)?.nameUk ?? slug,
      onRemove: () => toggleOption(slug),
    });
  }
  for (const slug of currentArray('tags')) {
    active.push({
      id: `tag:${slug}`,
      label: tags.find((tg) => tg.slug === slug)?.nameUk ?? slug,
      onRemove: () => toggleTag(slug),
    });
  }

  const applyLabel =
    resultCount == null ? t('filtersApply') : t('showResults', { count: resultCount });

  // Cap the pill cloud at 12, but never hide an option that is currently
  // applied — otherwise its only escape hatch would be the removable chip.
  const activeOptionSlugs = currentArray('options');
  const visibleOptions = [
    ...options.slice(0, 12),
    ...options.slice(12).filter((opt) => activeOptionSlugs.includes(opt.slug)),
  ];

  // Shared field stack — rendered in the desktop rail AND the mobile sheet.
  const fields = (
    <>
      <CarSetsField makes={makes} models={models} filters={carFilters} onChange={updateCars} />
      <SelectField
        label={t('filter.bodyType')}
        value={current('bodyType')}
        options={refsToOptions(bodyTypes)}
        placeholder={t('anyOption')}
        onChange={(v) => update({ bodyType: v })}
      />
      <SelectField
        label={t('filter.fuelType')}
        value={current('fuelType')}
        options={refsToOptions(fuelTypes)}
        placeholder={t('anyOption')}
        onChange={(v) => update({ fuelType: v })}
      />
      <SelectField
        label={t('filter.transmission')}
        value={current('transmission')}
        options={refsToOptions(transmissions)}
        placeholder={t('anyOption')}
        onChange={(v) => update({ transmission: v })}
      />
      <SelectField
        label={t('filter.driveType')}
        value={current('driveType')}
        options={refsToOptions(driveTypes)}
        placeholder={t('anyOption')}
        onChange={(v) => update({ driveType: v })}
      />
      <SelectField
        label={t('filter.condition')}
        value={cond}
        options={conditionOptions}
        placeholder={t('anyOption')}
        onChange={(v) => update({ condition: v })}
      />
      <div>
        <span className="mb-1.5 block text-label font-medium uppercase text-ink-2">
          {t('filter.city')}
        </span>
        <SearchField
          paramKey="city"
          value={city ?? ''}
          placeholder={t('cityPlaceholder')}
          clearLabel={t('search.clear')}
          icon={false}
          onCommit={(v) => update({ city: v })}
        />
      </div>
      <RangeField
        label={`${t('filter.price')}, ${currencySymbol}`}
        fromValue={priceMin}
        toValue={priceMax}
        fromPlaceholder={t('from')}
        toPlaceholder={t('to')}
        onFromChange={(v) => update({ priceMin: v })}
        onToChange={(v) => update({ priceMax: v })}
      />
      <RangeField
        label={`${t('filter.mileageMax')}, км`}
        fromValue={mileageMax}
        fromPlaceholder={t('to')}
        onFromChange={(v) => update({ mileageMax: v })}
      />
      {options.length > 0 && (
        <div>
          <span className="mb-2 block text-label font-medium uppercase text-ink-2">
            {t('filter.options')}
          </span>
          <div className="flex flex-wrap gap-2">
            {visibleOptions.map((opt) => (
              <FilterChip
                key={opt.slug}
                active={currentArray('options').includes(opt.slug)}
                onClick={() => toggleOption(opt.slug)}
              >
                {opt.nameUk}
              </FilterChip>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <span className="mb-2 block text-label font-medium uppercase text-ink-2">
            {t('filter.tags')}
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <FilterChip
                key={tag.slug}
                active={currentArray('tags').includes(tag.slug)}
                onClick={() => toggleTag(tag.slug)}
              >
                {tag.nameUk}
              </FilterChip>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const sortSelect = (
    <label className="flex min-w-0 max-w-full items-center gap-2">
      <span className="sr-only">{t('sortLabel')}</span>
      <select
        value={currentSort}
        onChange={(e) => update({ sort: e.target.value })}
        className="focus-ring h-10 min-w-0 max-w-full appearance-none rounded-btn border border-line-input bg-surface px-3 pr-7 text-sub font-medium text-ink bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27 xmlns=%27http://www.w3.org/2000/svg%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%23948C79%27 stroke-width=%271.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E')] bg-[position:right_10px_center] bg-no-repeat"
      >
        {SORT_VALUES.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="md:flex">
      {/* ---------------- Desktop filter rail ---------------- */}
      <aside className="hidden w-rail shrink-0 border-r border-line bg-surface-2 md:block">
        <div className="sticky top-header space-y-4 px-5 py-6">
          <SearchField
            paramKey="q"
            value={q ?? ''}
            placeholder={t('search.placeholder')}
            clearLabel={t('search.clear')}
            onCommit={(v) => update({ q: v })}
          />
          <Eyebrow as="div" className="pt-1">
            {t('filterTitle')}
          </Eyebrow>
          {fields}
        </div>
      </aside>

      {/* ---------------- Results column ---------------- */}
      <div className="min-w-0 flex-1 px-5 py-6 md:px-7">
        {/* Mobile controls */}
        <div className="space-y-3 md:hidden">
          <SearchField
            paramKey="q"
            value={q ?? ''}
            placeholder={t('search.placeholder')}
            clearLabel={t('search.clear')}
            className="h-11"
            onCommit={(v) => update({ q: v })}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={
                active.length > 0 ? `${t('filtersOpen')} · ${active.length}` : t('filtersOpen')
              }
              className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-input bg-ink text-sub font-medium text-bg"
            >
              <span aria-hidden>⚙</span>
              {t('filtersOpen')}
              {active.length > 0 && (
                <span
                  aria-hidden
                  className="flex h-5 min-w-5 items-center justify-center rounded-chip bg-accent px-1.5 text-[0.6875rem] font-medium text-on-accent"
                >
                  {active.length}
                </span>
              )}
            </button>
            {sortSelect}
          </div>
          <ActiveChipsRow
            filters={active}
            resetLabel={t('activeReset')}
            removeLabel={t('removeFilter')}
            onResetAll={resetAll}
            scrollable
          />
        </div>

        {/* Results header */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 md:mt-0">
          <div>
            <h1 className="font-heading text-title-lg font-medium text-ink">{title}</h1>
            {resultCount != null && (
              <p className="mt-1 text-body-md text-ink-2">
                <strong className="tabular font-medium text-ink">
                  {t('resultCount', { count: resultCount })}
                </strong>{' '}
                {t('countSuffix')}
              </p>
            )}
          </div>
          <div className="hidden md:block">{sortSelect}</div>
        </div>

        {/* Desktop chips */}
        <div className="mt-4 hidden md:block">
          <ActiveChipsRow
            filters={active}
            resetLabel={t('activeReset')}
            removeLabel={t('removeFilter')}
            onResetAll={resetAll}
          />
        </div>

        <div className="mt-6">{children}</div>
      </div>

      {/* ---------------- Mobile sheet ---------------- */}
      <FilterSheet
        open={sheetOpen}
        title={t('filterTitle')}
        resetLabel={t('filtersReset')}
        applyLabel={applyLabel}
        onClose={() => setSheetOpen(false)}
        onReset={resetAll}
      >
        {fields}
      </FilterSheet>
    </div>
  );
}

function refsToOptions(refs: CatalogRef[]): Array<{ label: string; value: string }> {
  return refs.map((r) => ({ label: r.nameUk, value: r.slug }));
}
