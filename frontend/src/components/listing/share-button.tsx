'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type ShareState = 'idle' | 'copied' | 'error';

/**
 * "↗ Поділитись" — native Web Share where available, clipboard fallback with
 * a short confirmation state. A denied clipboard write used to be swallowed;
 * now it is shown inline for a few seconds and announced through a polite live
 * region, because a silent no-op looks like a broken button.
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('listing');
  const [state, setState] = useState<ShareState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Show a transient confirmation/error, replacing any state already visible. */
  const flash = (next: Exclude<ShareState, 'idle'>, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    setState(next);
    timer.current = setTimeout(() => setState('idle'), ms);
  };

  const share = async () => {
    const url = window.location.href;
    if (timer.current) clearTimeout(timer.current);
    setState('idle');
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('copied', 2000);
    } catch (err) {
      // Dismissing the native share sheet is a deliberate action, not a
      // failure. Any other rejection — most importantly a denied clipboard
      // write (insecure context, missing permission) — is surfaced.
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
      flash('error', 3000);
    }
  };

  const message = state === 'copied' ? t('shareCopied') : state === 'error' ? t('shareFailed') : '';

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="focus-ring inline-flex h-[38px] items-center gap-1.5 rounded-btn border border-line-input bg-surface px-3.5 text-sub font-medium text-ink-2 transition-colors hover:border-line-hover hover:text-ink"
      >
        <span aria-hidden>↗</span>
        {state === 'copied' ? t('shareCopied') : t('share')}
      </button>
      {/* A changing button label is not reliably announced; one polite live
          region carries both the copy confirmation and the error. It is only
          visible (and styled as an error) when the copy/write actually failed. */}
      <span
        role="status"
        aria-live="polite"
        className={state === 'error' ? 'text-sub font-medium text-danger' : 'sr-only'}
      >
        {message}
      </span>
    </span>
  );
}
