'use client';

import { useTranslations } from 'next-intl';
import type { AdminListing } from '@/lib/api/admin';
import type { CatalogRef } from '@/lib/api/types';
import { CheckboxField, SelectField, TextField } from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import { ColorField } from './color-field';
import type { FieldErrorOf } from './listing-form-ui';

type RefField = 'bodyTypeId' | 'fuelTypeId' | 'transmissionId' | 'driveTypeId';

/** «Характеристики»: mileage, dictionary selects, engine, condition. */
export function ListingSpecsSection({
  catalog,
  initial,
  err,
}: {
  catalog: Record<
    'bodyTypes' | 'fuelTypes' | 'transmissions' | 'driveTypes' | 'colors',
    CatalogRef[]
  >;
  initial?: AdminListing;
  err: FieldErrorOf;
}) {
  const t = useTranslations('admin');
  const refSelects: Array<[RefField, string, CatalogRef[]]> = [
    ['bodyTypeId', t('form.body'), catalog.bodyTypes],
    ['fuelTypeId', t('form.fuel'), catalog.fuelTypes],
    ['transmissionId', t('form.transmission'), catalog.transmissions],
    ['driveTypeId', t('form.drive'), catalog.driveTypes],
  ];

  return (
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
        {refSelects.map(([name, label, items]) => (
          <SelectField
            key={name}
            label={label}
            name={name}
            required
            defaultValue={initial?.[name] ?? ''}
            error={err(name)}
          >
            <option value="">{t('form.selectPlaceholder')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nameUk}
              </option>
            ))}
          </SelectField>
        ))}
        <ColorField
          colors={catalog.colors}
          defaultValue={initial?.colorId ?? ''}
          error={err('colorId')}
        />
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
  );
}
