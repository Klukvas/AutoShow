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
      <div className="rounded-none border border-line bg-surface shadow-none">
        <EmptyState
          icon={<span className="text-[1.25rem]">⚠</span>}
          title={t('errorTitle')}
          body={t('errorBody')}
          action={
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="focus-ring inline-flex h-10 items-center rounded-none bg-accent px-4 text-[0.8125rem] font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                {t('retry')}
              </button>
              <Link
                href="/admin/listings"
                className="focus-ring inline-flex h-10 items-center rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink"
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
