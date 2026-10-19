'use client';

import { useTranslations } from 'next-intl';
import type { AdminListing } from '@/lib/api/admin';
import { TextField, TextareaField } from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import { ListingAiPanel } from './listing-ai-panel';
import type { FieldErrorOf } from './listing-form-ui';

export type AiTexts = Partial<Record<'description' | 'metaTitle' | 'metaDescription', string>>;

/** «Опис»: title, description, SEO texts and, for a saved listing, the AI drafts. */
export function ListingDescriptionSection({
  initial,
  err,
  onApplyAi,
}: {
  initial?: AdminListing;
  err: FieldErrorOf;
  onApplyAi: (values: AiTexts) => void;
}) {
  const t = useTranslations('admin');
  return (
    <>
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
            rows={8}
            defaultValue={initial?.description ?? ''}
            error={err('description')}
          />
          <TextField
            label={t('form.metaTitle')}
            name="metaTitle"
            maxLength={255}
            hint={t('form.metaTitleHint')}
            defaultValue={initial?.metaTitle ?? ''}
            error={err('metaTitle')}
          />
          <TextareaField
            label={t('form.metaDescription')}
            name="metaDescription"
            maxLength={320}
            rows={2}
            hint={t('form.metaDescriptionHint')}
            defaultValue={initial?.metaDescription ?? ''}
            error={err('metaDescription')}
          />
        </div>
      </SectionCard>

      {initial && (
        <ListingAiPanel
          listingId={initial.id}
          saved={{
            description: initial.description ?? '',
            metaTitle: initial.metaTitle ?? '',
            metaDescription: initial.metaDescription ?? '',
          }}
          onApply={onApplyAi}
        />
      )}
    </>
  );
}
