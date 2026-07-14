'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminListing, type FeeType, type SellerType } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { CatalogMake, CatalogModel, CatalogRef, VehicleOption } from '@/lib/api/types';
import {
  listingBodyFromValues,
  parseListingForm,
  YEAR_MAX,
  YEAR_MIN,
  type FieldIssue,
} from '@/lib/admin/listing-form-schema';
import { cityOptions } from '@/lib/admin/cities';
import { slugify } from '@/lib/admin/slugify';
import { Banner } from '@/components/admin/ui/banner';
import { ListingStatusBadge } from '@/components/admin/ui/badges';
import {
  CheckboxField,
  ChipCheckbox,
  SelectField,
  TextField,
  TextareaField,
  ToggleField,
} from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import { Dialog } from '@/components/admin/ui/dialog';
import { TransitionMenu } from './transition-menu';

export interface ListingCatalog {
  makes: CatalogMake[];
  models: CatalogModel[];
  bodyTypes: CatalogRef[];
  fuelTypes: CatalogRef[];
  transmissions: CatalogRef[];
  driveTypes: CatalogRef[];
  colors: CatalogRef[];
  options: VehicleOption[];
}

interface ListingFormProps {
  catalog: ListingCatalog;
  /** Present → edit mode (PATCH with optimistic-lock version). */
  initial?: AdminListing;
  /** Catalog writes are admin-only; hides the "add option" affordance for editors. */
  canManageCatalog?: boolean;
}

const CATEGORY_ORDER = ['comfort', 'safety', 'multimedia', 'interior', 'exterior', 'other'];

/**
 * Handoff 1d: grouped form (Автомобіль / Характеристики / Ціна та локація /
 * Опції / Опис), dependent model select, field-level validation and the 409
 * conflict banner with «Перезавантажити».
 */
export function ListingForm({ catalog, initial, canManageCatalog = false }: ListingFormProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('listing.optionCategories');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);

  const [pending, setPending] = useState<null | 'save' | 'publish'>(null);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldIssue>>({});
  const [makeId, setMakeId] = useState(initial?.makeId ?? '');
  const [confirmPublish, setConfirmPublish] = useState(false);
  // Consignment section: seller/fee kind drive which detail fields render.
  const [sellerType, setSellerType] = useState<SellerType>(initial?.sellerType ?? 'own');
  const [feeType, setFeeType] = useState<FeeType>(initial?.feeType ?? 'none');
  // Options created inline from this form (admin-only); pre-checked chips.
  const [extraOptions, setExtraOptions] = useState<VehicleOption[]>([]);
  const [optDialog, setOptDialog] = useState(false);
  const [optName, setOptName] = useState('');
  const [optCategory, setOptCategory] = useState<VehicleOption['category']>('other');
  const [optSaving, setOptSaving] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  const models = useMemo(
    () => catalog.models.filter((m) => !makeId || m.makeId === makeId),
    [catalog.models, makeId],
  );
  const optionGroups = useMemo(() => {
    const normalized = (c: string) => (CATEGORY_ORDER.includes(c) ? c : 'other');
    const all = [...catalog.options, ...extraOptions];
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: all.filter((o) => normalized(o.category) === cat),
    })).filter((g) => g.items.length > 0);
  }, [catalog.options, extraOptions]);
  const selectedOptionIds = useMemo(
    () => new Set((initial?.options ?? []).map((o) => o.optionId)),
    [initial],
  );
  const extraOptionIds = useMemo(() => new Set(extraOptions.map((o) => o.id)), [extraOptions]);

  const createOption = async () => {
    const nameUk = optName.trim();
    if (nameUk.length < 2) {
      setOptError(t('form.vMinLength', { min: 2 }));
      return;
    }
    setOptSaving(true);
    setOptError(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setOptError(t('common.sessionExpired'));
        return;
      }
      const created = await adminApi.createCatalogOption(
        { nameUk, slug: slugify(nameUk), category: optCategory },
        { accessToken: token },
      );
      setExtraOptions((prev) => [...prev, created]);
      setOptDialog(false);
      setOptName('');
      setOptCategory('other');
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) setOptError(t('form.optionExists'));
      else if (e instanceof ApiClientError) setOptError(e.message);
      else setOptError(t('form.optionCreateFailed'));
    } finally {
      setOptSaving(false);
    }
  };

  const err = (field: string): string | null => {
    const issue = fieldErrors[field];
    if (!issue) return null;
    return t(`form.${issue.key}` as never, issue.params as never);
  };

  const collect = () => {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    const raw: Record<string, unknown> = {
      makeId: data.get('makeId') ?? '',
      modelId: data.get('modelId') ?? '',
      year: data.get('year') ?? '',
      generation: data.get('generation') ?? '',
      modification: data.get('modification') ?? '',
      vin: data.get('vin') ?? '',
      vinVisible: data.get('vinVisible') === 'on',
      mileageKm: data.get('mileageKm') ?? '',
      bodyTypeId: data.get('bodyTypeId') ?? '',
      fuelTypeId: data.get('fuelTypeId') ?? '',
      transmissionId: data.get('transmissionId') ?? '',
      driveTypeId: data.get('driveTypeId') ?? '',
      colorId: data.get('colorId') ?? '',
      engineVolumeL: data.get('engineVolumeL') ?? '',
      powerHp: data.get('powerHp') ?? '',
      condition: data.get('condition') ?? 'used',
      ownersCount: data.get('ownersCount') ?? '',
      isCrashed: data.get('isCrashed') === 'on',
      customsCleared: data.get('customsCleared') === 'on',
      priceAmount: data.get('priceAmount') ?? '',
      priceCurrency: data.get('priceCurrency') ?? 'USD',
      isNegotiable: data.get('isNegotiable') === 'on',
      title: data.get('title') ?? '',
      description: data.get('description') ?? '',
      locationCity: data.get('locationCity') ?? '',
      optionIds: data.getAll('optionIds').map(String),
      sellerType: data.get('sellerType') ?? 'own',
      sellerName: data.get('sellerName') ?? '',
      sellerPhone: data.get('sellerPhone') ?? '',
      feeType: data.get('feeType') ?? 'none',
      feePercent: data.get('feePercent') ?? '',
      feeFixedAmount: data.get('feeFixedAmount') ?? '',
    };
    const parsed = parseListingForm(raw);
    setFieldErrors(parsed.errors);
    if (!parsed.values) {
      setError(t('form.formInvalid'));
      // Move focus to the first invalid control for keyboard/AT users.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return null;
    }
    setError(null);
    return parsed.values;
  };

  const handleApiError = (e: unknown) => {
    // A 409 from the PATCH itself must NOT auto-refresh: the user's edits are
    // unsaved and a refresh would remount the form (version key) and destroy
    // them. The banner leaves the choice («Перезавантажити») to the user.
    if (e instanceof ApiClientError && e.status === 409) setConflict(true);
    else if (e instanceof ApiClientError && e.status === 429) setError(t('common.rateLimited'));
    else if (e instanceof ApiClientError && e.status === 404) setError(t('form.notFoundBanner'));
    else if (e instanceof ApiClientError) setError(e.message);
    else setError(t('common.errorTitle'));
  };

  /** save → optionally publish → land on the edit screen with fresh state. */
  const submit = async (publish: boolean) => {
    if (pending) return;
    const values = collect();
    if (!values) return;
    setPending(publish ? 'publish' : 'save');
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      const body = listingBodyFromValues(values);
      let saved: AdminListing;
      if (isEdit && initial) {
        saved = await adminApi.updateListing(
          initial.id,
          { ...body, version: initial.version },
          { accessToken },
        );
      } else {
        saved = await adminApi.createListing(body, { accessToken });
      }
      if (publish) {
        // Save may have taken a while — a stale token here would 401.
        const publishToken = (await fetchAccessToken()) ?? accessToken;
        await adminApi.transitionListing(saved.id, 'publish', saved.version, {
          accessToken: publishToken,
        });
      }
      if (isEdit && initial) {
        router.refresh();
      } else {
        router.push(`/admin/listings/${saved.id}/edit`);
        router.refresh();
      }
    } catch (e) {
      handleApiError(e);
    } finally {
      setPending(null);
      setConfirmPublish(false);
    }
  };

  const gridCls = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3';
  const secondaryBtn =
    'focus-ring inline-flex h-10 items-center rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink transition-none hover:border-line-hover disabled:opacity-50';
  const primaryBtn =
    'focus-ring inline-flex h-10 items-center rounded-[9px] bg-accent px-[18px] text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50';

  const canPublish = !initial || initial.status !== 'published';

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {/* 409 conflict banner */}
      {conflict && (
        <Banner
          tone="warning"
          className="mb-4"
          action={
            <button
              type="button"
              onClick={() => {
                setConflict(false);
                router.refresh();
              }}
              className="focus-ring h-[34px] rounded-[8px] border border-ratelimit-line bg-surface px-3.5 text-[12px] font-bold text-ratelimit"
            >
              {t('form.conflictReload')}
            </button>
          }
        >
          {t('form.conflictBanner')}
        </Banner>
      )}
      {error && (
        <Banner tone="error" className="mb-4">
          {error}
        </Banner>
      )}

      {/* Header: subtitle + title + actions */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink-3">
            {isEdit ? t('form.editSubtitle') : t('form.createSubtitle')}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="truncate font-heading text-[21px] font-extrabold tracking-tight">
              {initial?.title ?? t('form.createTitle')}
            </h1>
            {initial && <ListingStatusBadge status={initial.status} />}
          </div>
        </div>
        <div className="flex w-full items-center gap-[9px] sm:w-auto">
          <button type="submit" disabled={pending !== null} className={secondaryBtn}>
            {pending === 'save'
              ? t('common.saving')
              : isEdit
                ? t('form.saveChanges')
                : t('form.saveDraft')}
          </button>
          {canPublish && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => setConfirmPublish(true)}
              className={primaryBtn}
            >
              {pending === 'publish' ? t('common.saving') : t('form.publish')}
            </button>
          )}
          {initial && (
            <TransitionMenu
              listingId={initial.id}
              version={initial.version}
              status={initial.status}
              title={initial.title}
              onConflict={() => setConflict(true)}
              onError={setError}
              exclude={['publish']}
              priceAmount={initial.priceAmount}
              priceCurrency={initial.priceCurrency}
              feeType={initial.feeType}
              feePercent={initial.feePercent}
              feeFixedAmount={initial.feeFixedAmount}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        {/* Автомобіль */}
        <SectionCard title={t('form.groupVehicle')}>
          <div className={gridCls}>
            <SelectField
              label={t('form.make')}
              name="makeId"
              required
              value={makeId}
              onChange={(e) => setMakeId(e.target.value)}
              error={err('makeId')}
            >
              <option value="">{t('form.selectPlaceholder')}</option>
              {catalog.makes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameUk}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={
                <>
                  {t('form.model')}{' '}
                  <span className="font-normal text-ink-3">{t('form.modelHint')}</span>
                </>
              }
              name="modelId"
              required
              defaultValue={initial?.modelId ?? ''}
              error={err('modelId')}
            >
              <option value="">{t('form.selectPlaceholder')}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameUk}
                </option>
              ))}
            </SelectField>
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
        </SectionCard>

        {/* Характеристики + Ціна та локація */}
        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1.6fr_1fr]">
          <SectionCard title={t('form.groupSpecs')}>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <TextField
                label={t('form.mileage')}
                name="mileageKm"
                type="number"
                inputMode="numeric"
                min={0}
                required
                defaultValue={initial?.mileageKm ?? ''}
                error={err('mileageKm')}
              />
              <SelectField
                label={t('form.body')}
                name="bodyTypeId"
                required
                defaultValue={initial?.bodyTypeId ?? ''}
                error={err('bodyTypeId')}
              >
                <option value="">{t('form.selectPlaceholder')}</option>
                {catalog.bodyTypes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUk}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('form.fuel')}
                name="fuelTypeId"
                required
                defaultValue={initial?.fuelTypeId ?? ''}
                error={err('fuelTypeId')}
              >
                <option value="">{t('form.selectPlaceholder')}</option>
                {catalog.fuelTypes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUk}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('form.transmission')}
                name="transmissionId"
                required
                defaultValue={initial?.transmissionId ?? ''}
                error={err('transmissionId')}
              >
                <option value="">{t('form.selectPlaceholder')}</option>
                {catalog.transmissions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUk}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('form.drive')}
                name="driveTypeId"
                required
                defaultValue={initial?.driveTypeId ?? ''}
                error={err('driveTypeId')}
              >
                <option value="">{t('form.selectPlaceholder')}</option>
                {catalog.driveTypes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUk}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('form.color')}
                name="colorId"
                required
                defaultValue={initial?.colorId ?? ''}
                error={err('colorId')}
              >
                <option value="">{t('form.selectPlaceholder')}</option>
                {catalog.colors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUk}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('form.engineVolume')}
                name="engineVolumeL"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0.1}
                max={99.9}
                required
                defaultValue={initial?.engineVolumeL ?? ''}
                error={err('engineVolumeL')}
              />
              <TextField
                label={t('form.power')}
                name="powerHp"
                type="number"
                inputMode="numeric"
                min={1}
                max={2500}
                required
                defaultValue={initial?.powerHp ?? ''}
                error={err('powerHp')}
              />
              <SelectField
                label={t('form.condition')}
                name="condition"
                required
                defaultValue={initial?.condition ?? 'used'}
                error={err('condition')}
              >
                <option value="used">{t('form.conditionUsed')}</option>
                <option value="new">{t('form.conditionNew')}</option>
                <option value="damaged">{t('form.conditionDamaged')}</option>
              </SelectField>
              <TextField
                label={t('form.owners')}
                name="ownersCount"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                defaultValue={initial?.ownersCount ?? 1}
                error={err('ownersCount')}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5">
              <CheckboxField
                label={t('form.crashed')}
                name="isCrashed"
                defaultChecked={initial?.isCrashed ?? false}
              />
              <CheckboxField
                label={t('form.customs')}
                name="customsCleared"
                defaultChecked={initial?.customsCleared ?? true}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('form.groupPrice')}>
            <div className="flex gap-2">
              <TextField
                label={t('form.price')}
                name="priceAmount"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                required
                defaultValue={initial?.priceAmount ?? ''}
                error={err('priceAmount')}
                className="flex-1"
              />
              <SelectField
                label={t('form.currency')}
                name="priceCurrency"
                defaultValue={initial?.priceCurrency ?? 'USD'}
                className="w-[92px] flex-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="UAH">UAH</option>
              </SelectField>
            </div>
            <CheckboxField
              label={t('form.negotiable')}
              name="isNegotiable"
              defaultChecked={initial?.isNegotiable ?? false}
            />
            <SelectField
              label={t('form.city')}
              name="locationCity"
              required
              defaultValue={initial?.locationCity ?? ''}
              error={err('locationCity')}
            >
              <option value="">{t('form.selectPlaceholder')}</option>
              {cityOptions(initial?.locationCity).map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </SelectField>
          </SectionCard>

          <SectionCard title={t('form.groupSeller')}>
            <div className="flex flex-col gap-3.5">
              <SelectField
                label={t('form.sellerType')}
                name="sellerType"
                value={sellerType}
                onChange={(e) => setSellerType(e.target.value as SellerType)}
              >
                <option value="own">{t('form.sellerOwn')}</option>
                <option value="client">{t('form.sellerClient')}</option>
              </SelectField>
              {sellerType === 'client' && (
                <>
                  <TextField
                    label={t('form.sellerName')}
                    name="sellerName"
                    maxLength={128}
                    defaultValue={initial?.sellerName ?? ''}
                    error={err('sellerName')}
                  />
                  <TextField
                    label={t('form.sellerPhone')}
                    name="sellerPhone"
                    maxLength={32}
                    defaultValue={initial?.sellerPhone ?? ''}
                    error={err('sellerPhone')}
                  />
                </>
              )}
              <SelectField
                label={t('form.feeType')}
                name="feeType"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value as FeeType)}
                hint={t('form.feeHint')}
              >
                <option value="none">{t('form.feeNone')}</option>
                <option value="fixed">{t('form.feeFixed')}</option>
                <option value="percent">{t('form.feePercentOption')}</option>
              </SelectField>
              {feeType === 'percent' && (
                <TextField
                  label={t('form.feePercentLabel')}
                  name="feePercent"
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={100}
                  step="0.1"
                  required
                  defaultValue={initial?.feePercent ? String(Number(initial.feePercent)) : ''}
                  error={err('feePercent')}
                />
              )}
              {feeType === 'fixed' && (
                <TextField
                  label={t('form.feeFixedLabel')}
                  name="feeFixedAmount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  required
                  defaultValue={
                    initial?.feeFixedAmount ? String(Number(initial.feeFixedAmount)) : ''
                  }
                  error={err('feeFixedAmount')}
                />
              )}
              {initial?.status === 'sold' && initial.salePriceAmount && (
                <p className="rounded-[9px] bg-ok-bg px-3 py-2 text-[13px] font-semibold text-ok">
                  {t('form.saleResult', {
                    price: `${Number(initial.salePriceAmount).toLocaleString('uk-UA')} ${initial.priceCurrency}`,
                    commission: `${Number(initial.commissionAmount ?? 0).toLocaleString('uk-UA')} ${initial.priceCurrency}`,
                  })}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Опції */}
        {(optionGroups.length > 0 || canManageCatalog) && (
          <SectionCard title={t('form.groupOptions')}>
            <div className="flex flex-col gap-4">
              {optionGroups.map((g) => (
                <div key={g.cat}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                    {tc(g.cat as never)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((opt) => (
                      <ChipCheckbox
                        key={opt.id}
                        name="optionIds"
                        value={opt.id}
                        defaultChecked={selectedOptionIds.has(opt.id) || extraOptionIds.has(opt.id)}
                        label={opt.nameUk}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {canManageCatalog && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setOptError(null);
                      setOptDialog(true);
                    }}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-accent hover:text-accent"
                  >
                    <span aria-hidden>+</span>
                    {t('form.addOption')}
                  </button>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Опис */}
        <SectionCard title={t('form.groupDescription')}>
          <div className="flex flex-col gap-3.5">
            <TextField
              label={t('form.titleField')}
              name="title"
              minLength={8}
              maxLength={255}
              required
              defaultValue={initial?.title ?? ''}
              error={err('title')}
            />
            <TextareaField
              label={t('form.description')}
              name="description"
              required
              minLength={20}
              maxLength={10000}
              rows={5}
              defaultValue={initial?.description ?? ''}
              error={err('description')}
            />
          </div>
        </SectionCard>
      </div>

      {/* Publish confirmation (status transitions always confirm) */}
      <Dialog
        open={confirmPublish}
        onClose={() => (pending ? null : setConfirmPublish(false))}
        title={t('form.transitionTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmPublish(false)}
              disabled={pending !== null}
              className={secondaryBtn}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={pending !== null}
              className={primaryBtn}
            >
              {pending === 'publish' ? t('common.saving') : t('form.publish')}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
          {t('form.transitionBody', {
            title: initial?.title ?? t('form.createTitle'),
            action: t('form.tPublish'),
          })}
        </p>
      </Dialog>

      {/* Inline "new option" (admin-only). Fields carry no `name` so they never
          leak into the listing FormData; Enter is intercepted so it can't
          submit the outer form. */}
      <Dialog
        open={optDialog}
        onClose={() => (optSaving ? null : setOptDialog(false))}
        title={t('form.addOptionTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOptDialog(false)}
              disabled={optSaving}
              className={secondaryBtn}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void createOption()}
              disabled={optSaving}
              className={primaryBtn}
            >
              {optSaving ? t('common.saving') : t('form.optionCreate')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {optError && <Banner tone="error">{optError}</Banner>}
          <TextField
            label={t('form.optionName')}
            required
            minLength={2}
            maxLength={128}
            value={optName}
            onChange={(e) => setOptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void createOption();
              }
            }}
          />
          <SelectField
            label={t('form.optionCategory')}
            value={optCategory}
            onChange={(e) => setOptCategory(e.target.value as VehicleOption['category'])}
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {tc(cat as never)}
              </option>
            ))}
          </SelectField>
        </div>
      </Dialog>
    </form>
  );
}
