'use client';
import { useTranslations } from 'next-intl';
import type { ListingAiFlag } from '@/lib/admin/listing-ai';

/** The checks the server raised on a draft, in plain Ukrainian. */
export function ListingAiFlags({ flags }: { flags: readonly ListingAiFlag[] }) {
  const t = useTranslations('admin.listingAi');
  if (flags.length === 0) return <p className="text-sm text-ink-2">{t('noFlags')}</p>;
  return (
    <div className="border border-ratelimit-line bg-ratelimit-bg p-3">
      <p className="text-sm font-medium text-ratelimit">
        {t('flagsTitle', { count: flags.length })}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-ink">
        {flags.map((flag, index) => (
          <li key={`${flag.reason}-${flag.claim}-${index}`} className="leading-snug">
            <span className="font-medium">«{flag.claim}»</span>
            {' — '}
            {t(`flagReason.${flag.reason}`)}
            {flag.field && <span className="text-ink-3"> ({t(`field.${flag.field}`)})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
