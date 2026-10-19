'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminListing, FeeType, SellerType } from '@/lib/api/admin';
import { cityOptions } from '@/lib/admin/cities';
import { CheckboxField, SelectField, TextField } from '@/components/admin/ui/field';
import { SectionCard } from '@/components/admin/ui/section-card';
import type { FieldErrorOf } from './listing-form-ui';

interface SectionProps {
  initial?: AdminListing;
  err: FieldErrorOf;
}

/** «Ціна та локація». */
export function ListingPriceSection({ initial, err }: SectionProps) {
  const t = useTranslations('admin');
  return (
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
  );
}

const formatMoney = (amount: string | number, currency: string) =>
  `${Number(amount).toLocaleString('uk-UA')} ${currency}`;

/** «Продавець і комісія»: seller/fee kind drive which detail fields render. */
export function ListingSellerSection({ initial, err }: SectionProps) {
  const t = useTranslations('admin');
  const [sellerType, setSellerType] = useState<SellerType>(initial?.sellerType ?? 'own');
  const [feeType, setFeeType] = useState<FeeType>(initial?.feeType ?? 'none');

  return (
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
            defaultValue={initial?.feeFixedAmount ? String(Number(initial.feeFixedAmount)) : ''}
            error={err('feeFixedAmount')}
          />
        )}
        {initial?.status === 'sold' && initial.salePriceAmount && (
          <p className="rounded-none bg-ok-bg px-3 py-2 text-[0.8125rem] font-medium text-ok">
            {t('form.saleResult', {
              price: formatMoney(initial.salePriceAmount, initial.priceCurrency),
              commission: formatMoney(initial.commissionAmount ?? 0, initial.priceCurrency),
            })}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
