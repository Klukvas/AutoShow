'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, resolveLocale, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';

interface LanguageSwitcherProps {
  label: string;
  tone?: 'storefront' | 'admin';
}

export function LanguageSwitcher({ label, tone = 'storefront' }: LanguageSwitcherProps) {
  const locale = resolveLocale(useLocale());
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={
        tone === 'admin'
          ? 'flex h-9 w-full items-stretch border border-sb-input-line'
          : 'flex h-[38px] items-stretch rounded-btn border border-line-input bg-surface'
      }
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            aria-label={LOCALE_LABEL[code]}
            disabled={pending}
            onClick={() => choose(code)}
            className={cn(
              'focus-ring px-2.5 text-sub font-medium disabled:opacity-50',
              tone === 'admin' && 'flex-1 text-[0.75rem]',
              tone === 'admin'
                ? active
                  ? 'bg-sb-ink text-sb-bg'
                  : 'text-sb-ink-2 hover:text-sb-ink'
                : active
                  ? 'text-ink'
                  : 'text-ink-3 hover:text-ink',
            )}
          >
            {LOCALE_SHORT[code]}
          </button>
        );
      })}
    </div>
  );
}
