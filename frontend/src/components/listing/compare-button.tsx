'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useCompare } from '@/lib/compare';

interface CompareButtonProps {
  slug: string;
  variant?: 'overlay' | 'inline';
  className?: string;
}

/**
 * Toggle a car into the compare tray. Like FavoriteButton, cards are one big
 * <Link>, so the click must not navigate. Disabled (not present + tray full)
 * so the 3-car cap is obvious rather than a silent no-op.
 */
export function CompareButton({ slug, variant = 'overlay', className }: CompareButtonProps) {
  const t = useTranslations('compare');
  const { has, canAdd, toggle, ready } = useCompare();
  const active = ready && has(slug);
  const disabled = ready && !active && !canAdd(slug);

  return (
    <button
      type="button"
      aria-label={active ? t('remove') : t('add')}
      aria-pressed={active}
      disabled={disabled}
      title={disabled ? t('full') : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      className={cn(
        // Respond on press, not release (§1): the chip dips instantly under the
        // finger. Motion-reduce users get no scale, only the colour change.
        'focus-ring inline-flex items-center justify-center transition-[transform,background-color,border-color,color] duration-100 disabled:opacity-40 motion-safe:active:scale-[0.9]',
        variant === 'overlay' &&
          'h-9 w-9 rounded-full bg-surface/85 shadow-sm backdrop-blur-sm hover:bg-surface',
        variant === 'inline' &&
          'h-[38px] gap-2 rounded-btn border px-3 text-sub font-semibold hover:border-line-hover',
        variant === 'inline' &&
          (active
            ? 'border-accent bg-accent/[0.08] text-accent-hover'
            : 'border-line-input bg-surface text-ink'),
        className,
      )}
    >
      <CompareIcon
        className={cn(
          'h-[18px] w-[18px] transition-colors',
          active ? 'stroke-accent' : 'stroke-ink-2',
        )}
      />
      {variant === 'inline' && (active ? t('added') : t('add'))}
    </button>
  );
}

function CompareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden className={className}>
      <path d="M7 4v16M7 4 4 8m3-4 3 4M17 20V4m0 16 3-4m-3 4-3-4" />
    </svg>
  );
}
