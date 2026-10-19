'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminListing } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type {
  CatalogMake,
  CatalogModel,
  CatalogRef,
  CatalogTag,
  VehicleOption,
} from '@/lib/api/types';
import {
  listingBodyFromValues,
  parseListingForm,
  type FieldIssue,
} from '@/lib/admin/listing-form-schema';
import { tabsWithErrors } from '@/lib/admin/listing-form-tabs';
import { Banner } from '@/components/admin/ui/banner';
import { ListingStatusBadge } from '@/components/admin/ui/badges';
import { Dialog } from '@/components/admin/ui/dialog';
import { useToast } from '@/components/admin/ui/toast';
import { ListingDescriptionSection, type AiTexts } from './listing-form-description';
import { ListingEquipmentSection } from './listing-form-equipment';
import { ListingPriceSection, ListingSellerSection } from './listing-form-deal';
import { ListingSpecsSection } from './listing-form-specs';
import { ListingVehicleSection } from './listing-form-vehicle';
import { primaryBtn, secondaryBtn } from './listing-form-ui';
import {
  ListingTabList,
  ListingTabPanel,
  ListingTabsBoundary,
  listingPanelId,
  useListingTabs,
} from './listing-tabs';
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
  tags: CatalogTag[];
}

interface ListingFormProps {
  catalog: ListingCatalog;
  /** Present → edit mode (PATCH with optimistic-lock version). */
  initial?: AdminListing;
  /** Catalog writes are admin-only; hides the "add option" affordance for editors. */
  canManageCatalog?: boolean;
}

/**
 * The listing form split over the «Основне / Комплектація / Опис» tabs. All
 * tabs stay mounted inside one <form>, so a save reads every field; media
 * and Telegram panels are rendered by the page next to it.
 */
export function ListingForm(props: ListingFormProps) {
  return (
    <ListingTabsBoundary isSaved={Boolean(props.initial)}>
      <ListingFormBody {...props} />
    </ListingTabsBoundary>
  );
}

function ListingFormBody({ catalog, initial, canManageCatalog = false }: ListingFormProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial);
  const tabs = useListingTabs();

  const { toast } = useToast();
  const [pending, setPending] = useState<null | 'save' | 'publish'>(null);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldIssue>>({});
  const [confirmPublish, setConfirmPublish] = useState(false);
  const errorTabs = tabsWithErrors(Object.keys(fieldErrors));

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
      metaTitle: data.get('metaTitle') ?? '',
      metaDescription: data.get('metaDescription') ?? '',
      locationCity: data.get('locationCity') ?? '',
      optionIds: data.getAll('optionIds').map(String),
      tagIds: data.getAll('tagIds').map(String),
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
      // Stay on the current tab when it has errors, otherwise open the first
      // tab that does; then focus its first invalid control for keyboard/AT users.
      const invalidTabs = tabsWithErrors(Object.keys(parsed.errors));
      const target = invalidTabs.includes(tabs.active) ? tabs.active : invalidTabs[0];
      if (target) tabs.select(target);
      requestAnimationFrame(() => {
        document
          .getElementById(listingPanelId(target ?? tabs.active))
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
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

  /** Puts AI texts into the (uncontrolled) fields; they reach the listing on the normal save. */
  const applyAiTexts = (values: AiTexts) => {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
        field.value = value ?? '';
    }
  };

  /** save → optionally publish → land on the edit screen with fresh state. */
  const submit = async (publish: boolean) => {
    if (pending) return;
    const values = collect();
    if (!values) {
      // Close the publish dialog so the error banner and the focused field are reachable.
      setConfirmPublish(false);
      return;
    }
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
      toast(publish ? t('form.publishedToast') : t('form.savedToast'));
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

  // Publish requires at least one processed photo (backend 422s otherwise) and
  // photos are uploaded on the edit screen — so a brand-new listing is always
  // saved as a draft first.
  const canPublish = isEdit && initial?.status !== 'published';

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
              className="focus-ring h-[34px] rounded-none border border-ratelimit-line bg-surface px-3.5 text-[0.75rem] font-medium text-ratelimit"
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
          <div className="text-[0.75rem] font-medium text-ink-3">
            {isEdit ? t('form.editSubtitle') : t('form.createSubtitle')}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="truncate font-heading text-[1.3125rem] font-medium tracking-tight">
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

      <ListingTabList errorTabs={errorTabs} />

      <ListingTabPanel tab="main" className="flex flex-col gap-[22px]">
        <ListingVehicleSection
          makes={catalog.makes}
          models={catalog.models}
          initial={initial}
          err={err}
          onError={setError}
        />
        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1.6fr_1fr]">
          <ListingSpecsSection catalog={catalog} initial={initial} err={err} />
          <ListingPriceSection initial={initial} err={err} />
          <ListingSellerSection initial={initial} err={err} />
        </div>
      </ListingTabPanel>

      <ListingTabPanel tab="equipment" className="flex flex-col gap-[22px]">
        <ListingEquipmentSection
          options={catalog.options}
          tags={catalog.tags}
          initial={initial}
          canManageCatalog={canManageCatalog}
        />
      </ListingTabPanel>

      <ListingTabPanel tab="description" className="flex flex-col gap-[22px]">
        <ListingDescriptionSection initial={initial} err={err} onApplyAi={applyAiTexts} />
      </ListingTabPanel>

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
        <p className="text-[0.84375rem] font-medium leading-relaxed text-ink-2">
          {t('form.transitionBody', {
            title: initial?.title ?? t('form.createTitle'),
            action: t('form.tPublish'),
          })}
        </p>
      </Dialog>
    </form>
  );
}
