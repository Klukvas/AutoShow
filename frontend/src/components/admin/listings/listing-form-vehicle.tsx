'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminListing } from '@/lib/api/admin';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { CatalogMake, CatalogModel } from '@/lib/api/types';
import { YEAR_MAX, YEAR_MIN } from '@/lib/admin/listing-form-schema';
import { TextField, ToggleField } from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import { useToast } from '@/components/admin/ui/toast';
import { MakeEditor, ModelEditor } from '@/components/admin/catalog/catalog-editor';
import { CatalogCombobox } from './catalog-combobox';
import { formGridCls, type FieldErrorOf } from './listing-form-ui';

/** «Автомобіль»: make/model pickers with inline creation, year, VIN. */
export function ListingVehicleSection({
  makes: initialMakes,
  models: initialModels,
  initial,
  err,
  onError,
}: {
  makes: CatalogMake[];
  models: CatalogModel[];
  initial?: AdminListing;
  err: FieldErrorOf;
  /** Must be stable (a state setter): it is an effect dependency. */
  onError: (message: string) => void;
}) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [makeId, setMakeId] = useState(initial?.makeId ?? '');
  const [modelId, setModelId] = useState(initial?.modelId ?? '');
  // Makes/models created inline from the combobox this session.
  const [extraMakes, setExtraMakes] = useState<CatalogMake[]>([]);
  const [extraModels, setExtraModels] = useState<CatalogModel[]>([]);
  const [catalogDialog, setCatalogDialog] = useState<{
    kind: 'make' | 'model';
    name: string;
  } | null>(null);
  const [freshMakes, setFreshMakes] = useState<CatalogMake[] | null>(null);
  const [freshModels, setFreshModels] = useState<CatalogModel[] | null>(null);
  const catalogMutationVersion = useRef(0);
  const catalogRequestVersion = useRef(0);

  // Pickers use the authenticated uncached view, including updates made in the dictionary.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const requestVersion = ++catalogRequestVersion.current;
      const mutationVersion = catalogMutationVersion.current;
      try {
        const accessToken = await fetchAccessToken();
        if (!accessToken) return;
        const [nextMakes, nextModels] = await Promise.all([
          adminApi.listCatalogMakes({ accessToken }),
          adminApi.listCatalogModels(undefined, { accessToken }),
        ]);
        if (
          active &&
          requestVersion === catalogRequestVersion.current &&
          mutationVersion === catalogMutationVersion.current
        ) {
          setFreshMakes(nextMakes);
          setFreshModels(nextModels);
          // A later server read supersedes the inline creation cache. A read
          // started before a create completed must not discard that new item.
          setExtraMakes([]);
          setExtraModels([]);
          setMakeId((current) => (nextMakes.some((make) => make.id === current) ? current : ''));
          setModelId((current) =>
            nextModels.some((model) => model.id === current) ? current : '',
          );
        }
      } catch (cause) {
        if (active) onError(cause instanceof Error ? cause.message : t('form.catalogCreateFailed'));
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [t, onError]);

  const makes = useMemo(() => {
    const all = new Map((freshMakes ?? initialMakes).map((make) => [make.id, make]));
    extraMakes.forEach((make) => all.set(make.id, make));
    return [...all.values()];
  }, [freshMakes, initialMakes, extraMakes]);
  const models = useMemo(() => {
    const all = new Map((freshModels ?? initialModels).map((model) => [model.id, model]));
    extraModels.forEach((model) => all.set(model.id, model));
    return [...all.values()].filter((model) => model.makeId === makeId);
  }, [freshModels, initialModels, extraModels, makeId]);
  const selectedMake = makes.find((make) => make.id === makeId);

  return (
    <SectionCard title={t('form.groupVehicle')}>
      <div className={formGridCls}>
        <CatalogCombobox
          label={t('form.make')}
          name="makeId"
          required
          items={makes}
          value={makeId}
          onSelect={(id) => {
            setMakeId(id);
            // Models belong to a make — a make switch invalidates the pick.
            setModelId('');
          }}
          error={err('makeId')}
          placeholder={t('form.selectPlaceholder')}
          showLogos
          onCreate={(name) => setCatalogDialog({ kind: 'make', name })}
          addLabel={t('catalog.addMake')}
          unknownHint={(name) => t('form.makeUnknown', { name })}
          createLabel={(name) => t('form.makeCreate', { name })}
          creatingLabel={t('common.saving')}
          emptyLabel={t('form.comboNoMatch')}
        />
        <CatalogCombobox
          label={
            <>
              {t('form.model')}{' '}
              <span className="font-normal text-ink-3">{t('form.modelHint')}</span>
            </>
          }
          name="modelId"
          required
          items={models}
          value={modelId}
          onSelect={setModelId}
          error={err('modelId')}
          placeholder={makeId ? t('form.selectPlaceholder') : t('form.modelPickMakeFirst')}
          onCreate={makeId ? (name) => setCatalogDialog({ kind: 'model', name }) : undefined}
          addLabel={t('catalog.addModel')}
          unknownHint={(name) => t('form.modelUnknown', { name })}
          createLabel={(name) => t('form.modelCreate', { name })}
          creatingLabel={t('common.saving')}
          emptyLabel={makeId ? t('form.comboNoMatch') : t('form.modelPickMakeFirst')}
        />
        <TextField
          label={t('form.year')}
          name="year"
          type="number"
          inputMode="numeric"
          min={YEAR_MIN}
          max={YEAR_MAX}
          required
          defaultValue={initial?.year ?? ''}
          error={err('year')}
        />
        <TextField
          label={t('form.generation')}
          name="generation"
          defaultValue={initial?.generation ?? ''}
          error={err('generation')}
        />
        <TextField
          label={t('form.modification')}
          name="modification"
          defaultValue={initial?.modification ?? ''}
          error={err('modification')}
        />
        <TextField
          label={t('form.vin')}
          name="vin"
          maxLength={17}
          autoCapitalize="characters"
          defaultValue={initial?.vin ?? ''}
          error={err('vin')}
        />
      </div>
      <ToggleField
        label={t('form.vinVisible')}
        name="vinVisible"
        className="mt-2.5"
        defaultChecked={initial?.vinVisible ?? false}
      />

      {catalogDialog?.kind === 'make' && (
        <MakeEditor
          initialName={catalogDialog.name}
          onClose={() => setCatalogDialog(null)}
          onSaved={(make) => {
            catalogMutationVersion.current++;
            setExtraMakes((current) => [...current.filter((item) => item.id !== make.id), make]);
            setMakeId(make.id);
            setModelId('');
            setCatalogDialog(null);
            toast(t('form.makeCreated', { name: make.nameUk }));
          }}
        />
      )}
      {catalogDialog?.kind === 'model' && selectedMake && (
        <ModelEditor
          make={selectedMake}
          initialName={catalogDialog.name}
          onClose={() => setCatalogDialog(null)}
          onSaved={(model) => {
            catalogMutationVersion.current++;
            setExtraModels((current) => [...current.filter((item) => item.id !== model.id), model]);
            setModelId(model.id);
            setCatalogDialog(null);
            toast(t('form.modelCreated', { name: model.nameUk }));
          }}
        />
      )}
    </SectionCard>
  );
}
