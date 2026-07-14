'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from './theme-provider';
import { cn } from '@/lib/cn';

/**
 * ☾/☀ theme switch (38px per handoff header spec). Both glyphs are always in
 * the DOM and CSS-switched via the `dark:` variant, so the first paint is
 * correct even before hydration — no mismatch, no icon flicker.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  const { toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('toggle')}
      title={t('toggle')}
      className={cn(
        'focus-ring flex h-[38px] w-[38px] items-center justify-center rounded-btn border border-line-input',
        'bg-surface text-ink transition-colors hover:border-line-hover',
        className,
      )}
    >
      <span aria-hidden className="dark:hidden">
        ☾
      </span>
      <span aria-hidden className="hidden dark:inline">
        ☀
      </span>
    </button>
  );
}
