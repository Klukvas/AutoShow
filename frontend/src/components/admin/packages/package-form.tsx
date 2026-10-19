'use client';

import { useTranslations } from 'next-intl';
import { CheckboxField, ChipCheckbox, TextField, TextareaField } from '@/components/admin/ui/field';
import {
  PACKAGE_LIMITS,
  toggleChannel,
  type PackageDraft,
} from '@/lib/admin/placement-package-draft';
import { PLACEMENT_CHANNELS } from '@/lib/api/types';

interface PackageFormProps {
  draft: PackageDraft;
  onChange: (draft: PackageDraft) => void;
}

/** Fields of the add/edit tariff dialog. */
export function PackageForm({ draft, onChange }: PackageFormProps) {
  const t = useTranslations('admin.packages');
  const tc = useTranslations('placementChannels');

  return (
    <div className="flex flex-col gap-3.5">
      <TextField
        label={t('name')}
        required
        minLength={PACKAGE_LIMITS.titleMin}
        maxLength={PACKAGE_LIMITS.titleMax}
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />
      <TextareaField
        label={t('description')}
        maxLength={PACKAGE_LIMITS.descriptionMax}
        rows={2}
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
      />
      <div className="flex gap-3">
        <TextField
          label={t('price')}
          required
          inputMode="numeric"
          className="flex-1"
          value={draft.priceUah}
          onChange={(e) => onChange({ ...draft, priceUah: e.target.value })}
        />
        <TextField
          label={t('positionLabel')}
          type="number"
          min={0}
          className="flex-1"
          value={String(draft.position)}
          onChange={(e) => onChange({ ...draft, position: Number(e.target.value) || 0 })}
        />
      </div>
      <fieldset>
        <legend className="mb-[5px] block text-[0.75rem] font-medium text-ink-2">
          {t('channels')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PLACEMENT_CHANNELS.map((channel) => (
            <ChipCheckbox
              key={channel}
              label={tc(channel)}
              checked={draft.channels.includes(channel)}
              onChange={() =>
                onChange({ ...draft, channels: toggleChannel(draft.channels, channel) })
              }
            />
          ))}
        </div>
      </fieldset>
      <TextareaField
        label={t('features')}
        hint={t('featuresHint', { max: PACKAGE_LIMITS.featuresMax })}
        rows={4}
        value={draft.featuresText}
        onChange={(e) => onChange({ ...draft, featuresText: e.target.value })}
      />
      <CheckboxField
        label={t('featured')}
        checked={draft.isFeatured}
        onChange={(e) => onChange({ ...draft, isFeatured: e.target.checked })}
      />
    </div>
  );
}
