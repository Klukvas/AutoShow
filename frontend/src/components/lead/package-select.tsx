'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicPlacementPackage } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';

/**
 * "Що вас цікавить" in the sell form: consignment (the default, empty value)
 * or one of the published placement packages.
 */
export function PackageSelect({
  packages,
  value,
  onChange,
}: {
  packages: PublicPlacementPackage[];
  value: string;
  onChange: (packageId: string) => void;
}) {
  const t = useTranslations('sell');
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-label font-medium uppercase text-ink-2">
        {t('intent')}
      </label>
      <select
        id={id}
        name="packageId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring block h-11 w-full rounded-input border border-line-input bg-surface px-3 text-body-md text-ink outline-none transition-colors focus:border-ink-3"
      >
        <option value="">{t('intentConsignment')}</option>
        {packages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {t('intentPackage', { title: pkg.title, price: formatMoney(pkg.priceUah, 'UAH') })}
          </option>
        ))}
      </select>
      {value && <p className="mt-1.5 text-sub text-ink-2">{t('packageNote')}</p>}
    </div>
  );
}
