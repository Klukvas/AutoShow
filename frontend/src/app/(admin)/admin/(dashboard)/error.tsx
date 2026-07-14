'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/admin/ui/empty-state';

/**
 * Residual-error boundary for the admin dashboard (stray 500/network throw):
 * a recoverable panel instead of the raw Next.js crash screen.
 */
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('admin.common');
  useEffect(() => {
    // Surface the swallowed exception for diagnostics — the boundary UI
    // deliberately shows no stack to the admin.
    console.error('[admin]', error);
  }, [error]);
  return (
    <div className="mx-auto max-w-[560px] py-16">
      <div className="rounded-[14px] border border-line bg-surface shadow-panel">
        <EmptyState
          icon={<span className="text-[20px]">⚠</span>}
          title={t('errorTitle')}
          body={t('errorBody')}
          action={
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="focus-ring inline-flex h-10 items-center rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
              >
                {t('retry')}
              </button>
              <Link
                href="/admin/listings"
                className="focus-ring inline-flex h-10 items-center rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
              >
                {t('toListings')}
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
