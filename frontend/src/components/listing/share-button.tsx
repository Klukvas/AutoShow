'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * "↗ Поділитись" — native Web Share where available, clipboard fallback with
 * a short confirmation state.
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('listing');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard denied — nothing to report.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="focus-ring inline-flex h-[38px] items-center gap-1.5 rounded-btn border border-line-input bg-surface px-3.5 text-sub font-semibold text-ink-2 transition-colors hover:border-line-hover hover:text-ink"
    >
      <span aria-hidden>↗</span>
      {copied ? t('shareCopied') : t('share')}
    </button>
  );
}
