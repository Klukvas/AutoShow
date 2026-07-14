'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AUDIT_ENTITY_TYPES, type AuditPeriod } from '@/lib/admin/audit-format';

/** «Усі дії ▾» (entity type) + period selects — change resets pagination. */
export function AuditFilters({ entityType, period }: { entityType?: string; period: AuditPeriod }) {
  const t = useTranslations('admin.audit');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (nextType: string, nextPeriod: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.delete('stack');
    if (nextType) params.set('entityType', nextType);
    else params.delete('entityType');
    if (nextPeriod !== '7') params.set('period', nextPeriod);
    else params.delete('period');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const selectCls =
    'focus-ring h-9 rounded-[8px] border border-line-input bg-surface px-3 text-[12px] font-semibold text-ink-2 outline-none';

  return (
    <div className="flex gap-2">
      <select
        value={entityType ?? ''}
        aria-label={t('filterAllActions')}
        onChange={(e) => apply(e.target.value, period)}
        className={selectCls}
      >
        <option value="">{t('filterAllActions')}</option>
        {AUDIT_ENTITY_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`entity.${type}`)}
          </option>
        ))}
      </select>
      <select
        value={period}
        aria-label={t('filterPeriod')}
        onChange={(e) => apply(entityType ?? '', e.target.value)}
        className={selectCls}
      >
        <option value="7">{t('period7')}</option>
        <option value="30">{t('period30')}</option>
        <option value="all">{t('periodAll')}</option>
      </select>
    </div>
  );
}
