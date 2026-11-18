'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { LOCALES, LOCALE_LABEL, resolveLocale, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';

interface LanguageSwitcherProps {
  label: string;
  tone?: 'storefront' | 'admin';
}

export function LanguageSwitcher({ label, tone = 'storefront' }: LanguageSwitcherProps) {
  const locale = resolveLocale(useLocale());
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const admin = tone === 'admin';

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div ref={rootRef} className={cn('language-switcher relative', admin && 'w-full')}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'focus-ring flex items-center justify-between gap-2 rounded-btn border border-line-input bg-surface font-medium text-ink disabled:opacity-50',
          admin ? 'h-9 w-full px-2.5 text-[0.75rem]' : 'h-[38px] px-3 text-sub',
        )}
      >
        <span>{LOCALE_LABEL[locale]}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className={cn('h-2 w-3 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m1 1 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={cn(
            'absolute z-50 min-w-full rounded-btn border border-line-input bg-surface py-1 shadow-panel',
            admin ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {LOCALES.map((code) => {
            const active = code === locale;
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(code)}
                  className={cn(
                    'focus-ring block w-full px-3 py-2 text-left font-medium',
                    admin ? 'text-[0.75rem]' : 'text-sub',
                    active ? 'text-ink' : 'text-ink-2 hover:bg-ink/[0.04] hover:text-ink',
                  )}
                >
                  {LOCALE_LABEL[code]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
