'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MAX_COMPARE, useCompare } from '@/lib/compare';

/**
 * Global sticky tray showing how many cars are queued for comparison, with a
 * link to /compare and a clear button. Hidden when empty or already on the
 * /compare page (which has its own controls).
 */
export function CompareBar() {
  const t = useTranslations('compare');
  const pathname = usePathname();
  const { slugs, ready, clear } = useCompare();

  if (!ready || slugs.length === 0 || pathname === '/compare') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface/95 px-4 py-2.5 shadow-panel backdrop-blur-sm">
        <span className="text-sub font-semibold text-ink">
          {t('trayCount', { count: slugs.length, max: MAX_COMPARE })}
        </span>
        <Link
          href="/compare"
          className="focus-ring inline-flex h-9 items-center rounded-full bg-accent px-4 text-sub font-bold text-on-accent transition-colors hover:bg-accent-hover"
        >
          {t('open')}
        </Link>
        <button
          type="button"
          onClick={clear}
          className="focus-ring inline-flex h-9 items-center rounded-full px-2 text-sub font-semibold text-ink-3 hover:text-ink-2"
        >
          {t('clear')}
        </button>
      </div>
    </div>
  );
}
