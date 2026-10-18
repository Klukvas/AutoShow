'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MultiSelectField, RangeInput, SelectField } from '@/components/filters/filter-fields';
import {
  EMPTY_CAR_SET,
  MAX_CAR_SETS,
  MAX_EXCLUSIONS,
  MAX_MODELS_PER_SET,
  encodeCarSet,
  encodeExclusion,
  isEmptyCarSet,
  type CarExclusion,
  type CarFilters,
  type CarSet,
} from '@/lib/car-filter';
import type { CatalogMake, CatalogModel } from '@/lib/api/types';

interface CarSetsFieldProps {
  makes: CatalogMake[];
  models: CatalogModel[];
  filters: CarFilters;
  onChange: (next: CarFilters) => void;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** Only full, plausible years reach the URL — "20" mid-typing would 400 the API. */
function parseYear(raw: string | undefined): number | undefined {
  if (!raw || !/^\d{4}$/.test(raw)) return undefined;
  const year = Number(raw);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : undefined;
}

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return index < items.length
    ? items.map((existing, i) => (i === index ? item : existing))
    : [...items, item];
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/**
 * A row being added lives here until the URL catches up. The committed list
 * comes from useSearchParams, which only grows once the router transition
 * lands — dropping the draft earlier would unmount the row mid-typing.
 */
function usePendingRow<T>(committedCount: number) {
  const [pending, setPending] = useState<{ value: T; expectedCount: number } | null>(null);
  const isPending = pending != null && committedCount < pending.expectedCount;

  useEffect(() => {
    if (pending && committedCount >= pending.expectedCount) setPending(null);
  }, [committedCount, pending]);

  return {
    value: isPending ? pending.value : undefined,
    isPending,
    /** Shows (or updates) the row; it resolves once one more row is committed. */
    hold: (value: T) => setPending({ value, expectedCount: committedCount + 1 }),
    discard: () => setPending(null),
  };
}

/**
 * AutoRia-style vehicle sets: each row is "make + models + years", rows are
 * OR-ed, and a separate list excludes makes or models. A freshly added row
 * stays local until it has a make or a year — an empty set means nothing, so
 * it never reaches the URL.
 */
export function CarSetsField({ makes, models, filters, onChange }: CarSetsFieldProps) {
  const t = useTranslations('catalog');
  const { sets, exclusions } = filters;
  const draftSet = usePendingRow<CarSet>(sets.length);
  const draftExclusion = usePendingRow<CarExclusion | null>(exclusions.length);

  // With nothing selected there is always one empty row to start from.
  const setRows: CarSet[] =
    draftSet.isPending || sets.length === 0 ? [...sets, draftSet.value ?? EMPTY_CAR_SET] : sets;
  const exclusionRows: Array<CarExclusion | null> = draftExclusion.isPending
    ? [...exclusions, draftExclusion.value ?? null]
    : exclusions;

  const makeOptions = makes.map((m) => ({ label: m.nameUk, value: m.slug }));
  const modelOptionsFor = (makeSlug: string | undefined) => {
    const make = makes.find((m) => m.slug === makeSlug);
    return make
      ? models.filter((m) => m.makeId === make.id).map((m) => ({ label: m.nameUk, value: m.slug }))
      : [];
  };

  const changeSet = (index: number, next: CarSet) => {
    if (index < sets.length) {
      // "Any make" with no years means "any car": the set simply goes away,
      // same as its chip's ✕ (carFiltersPatch drops empty sets).
      onChange({ ...filters, sets: replaceAt(sets, index, next) });
      return;
    }
    // Picking a set that already exists just folds the draft into it.
    if (sets.some((set) => encodeCarSet(set) === encodeCarSet(next))) {
      draftSet.discard();
      return;
    }
    draftSet.hold(next);
    // An empty set (e.g. a year half-typed) stays a local draft.
    if (!isEmptyCarSet(next)) onChange({ ...filters, sets: [...sets, next] });
  };
  const removeSet = (index: number) => {
    if (index >= sets.length) {
      draftSet.discard();
      return;
    }
    onChange({ ...filters, sets: removeAt(sets, index) });
  };

  const changeExclusion = (index: number, next: CarExclusion | null) => {
    if (index < exclusions.length) {
      const nextExclusions = next
        ? replaceAt(exclusions, index, next)
        : removeAt(exclusions, index);
      onChange({ ...filters, exclusions: nextExclusions });
      return;
    }
    if (next && exclusions.some((e) => encodeExclusion(e) === encodeExclusion(next))) {
      draftExclusion.discard();
      return;
    }
    draftExclusion.hold(next);
    if (next) onChange({ ...filters, exclusions: [...exclusions, next] });
  };
  const removeExclusion = (index: number) => {
    if (index >= exclusions.length) {
      draftExclusion.discard();
      return;
    }
    onChange({ ...filters, exclusions: removeAt(exclusions, index) });
  };

  const canAddSet = setRows.length === sets.length && sets.length > 0 && sets.length < MAX_CAR_SETS;
  const canAddExclusion = !draftExclusion.isPending && exclusions.length < MAX_EXCLUSIONS;
  // The lone empty row is the default state, not something to remove.
  const isRemovable = (index: number) => setRows.length > 1 || index < sets.length;

  return (
    <div className="space-y-4">
      <div>
        <Eyebrow className="mb-1.5 block">{t('carSets.title')}</Eyebrow>
        <div className="space-y-2">
          {setRows.map((set, index) => (
            <CarSetRow
              key={index}
              set={set}
              index={index}
              makeOptions={makeOptions}
              modelOptions={modelOptionsFor(set.make)}
              removable={isRemovable(index)}
              onChange={(next) => changeSet(index, next)}
              onRemove={() => removeSet(index)}
            />
          ))}
        </div>
        {canAddSet && (
          <AddRowButton onClick={() => draftSet.hold(EMPTY_CAR_SET)}>
            + {t('carSets.add')}
          </AddRowButton>
        )}
      </div>

      <div>
        {exclusionRows.length > 0 && (
          <>
            <Eyebrow className="mb-1.5 block">{t('carSets.excludeTitle')}</Eyebrow>
            <div className="space-y-2">
              {exclusionRows.map((exclusion, index) => (
                <ExclusionRow
                  key={index}
                  exclusion={exclusion}
                  index={index}
                  makeOptions={makeOptions}
                  modelOptions={modelOptionsFor(exclusion?.make)}
                  onChange={(next) => changeExclusion(index, next)}
                  onRemove={() => removeExclusion(index)}
                />
              ))}
            </div>
          </>
        )}
        {canAddExclusion && (
          <AddRowButton onClick={() => draftExclusion.hold(null)}>
            − {t('carSets.excludeAdd')}
          </AddRowButton>
        )}
      </div>
    </div>
  );
}

interface Option {
  label: string;
  value: string;
}

function CarSetRow({
  set,
  index,
  makeOptions,
  modelOptions,
  removable,
  onChange,
  onRemove,
}: {
  set: CarSet;
  index: number;
  makeOptions: Option[];
  modelOptions: Option[];
  removable: boolean;
  onChange: (next: CarSet) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('catalog');
  const position = index + 1;
  return (
    <div className="space-y-2 rounded-input border border-line bg-surface p-2.5">
      <div className="flex items-center gap-1.5">
        <SelectField
          hideLabel
          label={`${t('filter.make')} ${position}`}
          value={set.make}
          options={makeOptions}
          placeholder={t('carSets.anyMake')}
          // A different make invalidates the chosen models.
          onChange={(make) => onChange({ ...set, make, models: [] })}
        />
        {removable && (
          <RemoveRowButton label={`${t('carSets.remove')} ${position}`} onClick={onRemove} />
        )}
      </div>
      <MultiSelectField
        label={`${t('carSets.models')} ${position}`}
        values={set.models}
        options={modelOptions}
        placeholder={t('carSets.anyModel')}
        maxSelected={MAX_MODELS_PER_SET}
        disabled={!set.make || modelOptions.length === 0}
        onChange={(models) => onChange({ ...set, models })}
      />
      <div className="flex items-center gap-2">
        <RangeInput
          ariaLabel={`${t('filter.yearMin')} ${position}`}
          placeholder={t('carSets.yearFrom')}
          value={set.yearFrom?.toString()}
          onChange={(raw) => onChange({ ...set, yearFrom: parseYear(raw) })}
        />
        <RangeInput
          ariaLabel={`${t('filter.yearMax')} ${position}`}
          placeholder={t('carSets.yearTo')}
          value={set.yearTo?.toString()}
          onChange={(raw) => onChange({ ...set, yearTo: parseYear(raw) })}
        />
      </div>
    </div>
  );
}

function ExclusionRow({
  exclusion,
  index,
  makeOptions,
  modelOptions,
  onChange,
  onRemove,
}: {
  exclusion: CarExclusion | null;
  index: number;
  makeOptions: Option[];
  modelOptions: Option[];
  onChange: (next: CarExclusion | null) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('catalog');
  const position = index + 1;
  return (
    <div className="space-y-2 rounded-input border border-dashed border-line bg-surface p-2.5">
      <div className="flex items-center gap-1.5">
        <SelectField
          hideLabel
          label={`${t('carSets.excludeMake')} ${position}`}
          value={exclusion?.make}
          options={makeOptions}
          placeholder={t('carSets.chooseMake')}
          onChange={(make) => onChange(make ? { make, models: [] } : null)}
        />
        <RemoveRowButton label={`${t('carSets.remove')} ${position}`} onClick={onRemove} />
      </div>
      {exclusion && (
        <MultiSelectField
          label={`${t('carSets.excludeModels')} ${position}`}
          values={exclusion.models}
          options={modelOptions}
          placeholder={t('carSets.allModels')}
          maxSelected={MAX_MODELS_PER_SET}
          disabled={modelOptions.length === 0}
          onChange={(models) => onChange({ ...exclusion, models })}
        />
      )}
    </div>
  );
}

function RemoveRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-ring flex h-10 w-8 shrink-0 items-center justify-center rounded-btn text-ink-3 hover:text-ink"
    >
      <span aria-hidden>✕</span>
    </button>
  );
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring mt-2 rounded-chip px-1 py-1 text-sub font-medium text-accent-hover hover:underline dark:text-accent"
    >
      {children}
    </button>
  );
}
