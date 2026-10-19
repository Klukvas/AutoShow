'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminListing } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { CatalogTag, VehicleOption } from '@/lib/api/types';
import { slugify } from '@/lib/admin/slugify';
import { Banner } from '@/components/admin/ui/banner';
import { ChipCheckbox, SelectField, TextField } from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import { Dialog } from '@/components/admin/ui/dialog';
import { primaryBtn, secondaryBtn } from './listing-form-ui';

const CATEGORY_ORDER = ['comfort', 'safety', 'multimedia', 'interior', 'exterior', 'other'];

/** «Комплектація»: option chips by category (admins can add one inline) and tags. */
export function ListingEquipmentSection({
  options,
  tags,
  initial,
  canManageCatalog,
}: {
  options: VehicleOption[];
  tags: CatalogTag[];
  initial?: AdminListing;
  canManageCatalog: boolean;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('listing.optionCategories');
  // Options created inline from this form (admin-only); pre-checked chips.
  const [extraOptions, setExtraOptions] = useState<VehicleOption[]>([]);
  const [optDialog, setOptDialog] = useState(false);
  const [optName, setOptName] = useState('');
  const [optCategory, setOptCategory] = useState<VehicleOption['category']>('other');
  const [optSaving, setOptSaving] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  const optionGroups = useMemo(() => {
    const normalized = (c: string) => (CATEGORY_ORDER.includes(c) ? c : 'other');
    const all = [...options, ...extraOptions];
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: all.filter((o) => normalized(o.category) === cat),
    })).filter((g) => g.items.length > 0);
  }, [options, extraOptions]);
  const selectedOptionIds = useMemo(
    () => new Set((initial?.options ?? []).map((o) => o.optionId)),
    [initial],
  );
  const extraOptionIds = useMemo(() => new Set(extraOptions.map((o) => o.id)), [extraOptions]);
  const selectedTagIds = useMemo(
    () => new Set((initial?.tags ?? []).map((tag) => tag.tagId)),
    [initial],
  );

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

  const showOptions = optionGroups.length > 0 || canManageCatalog;
  if (!showOptions && tags.length === 0)
    return <p className="text-sm text-ink-3">{t('form.tabs.equipmentEmpty')}</p>;

  return (
    <>
      {showOptions && (
        <SectionCard title={t('form.groupOptions')}>
          <div className="flex flex-col gap-4">
            {optionGroups.map((g) => (
              <div key={g.cat}>
                <div className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
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
                  className="focus-ring inline-flex items-center gap-1.5 rounded-none border border-dashed border-line-strong px-3 py-1.5 text-[0.78125rem] font-medium text-ink-2 hover:border-accent hover:text-accent"
                >
                  <span aria-hidden>+</span>
                  {t('form.addOption')}
                </button>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {tags.length > 0 && (
        <SectionCard title={t('form.groupTags')}>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <ChipCheckbox
                key={tag.id}
                name="tagIds"
                value={tag.id}
                defaultChecked={selectedTagIds.has(tag.id)}
                label={tag.nameUk}
              />
            ))}
          </div>
        </SectionCard>
      )}

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
    </>
  );
}
