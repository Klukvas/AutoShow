'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useFavorites } from '@/lib/favorites';

interface FavoriteButtonProps {
  slug: string;
  /** 'overlay' — round chip on the card photo; 'inline' — bordered button. */
  variant?: 'overlay' | 'inline';
  className?: string;
}

/**
 * Heart toggle. Cards are one big <Link>, so the click must not navigate —
 * hence preventDefault/stopPropagation.
 */
export function FavoriteButton({ slug, variant = 'overlay', className }: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const { has, toggle, ready } = useFavorites();
  const active = ready && has(slug);

  return (
    <button
      type="button"
      aria-label={active ? t('remove') : t('add')}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      className={cn(
        // Same press response as the sibling CompareButton: dips instantly under
        // the finger; motion-reduce users get only the colour change.
        'focus-ring inline-flex items-center justify-center transition-[transform,background-color,border-color,color] duration-100 motion-safe:active:scale-[0.9]',
        variant === 'overlay' &&
          'h-9 w-9 rounded-btn bg-surface/85 shadow-sm backdrop-blur-sm hover:bg-surface',
        variant === 'inline' &&
          'h-[38px] gap-2 rounded-btn border border-line-input bg-surface px-3 text-sub font-semibold text-ink hover:border-line-hover',
        className,
      )}
    >
      <HeartIcon
        className={cn(
          'h-[18px] w-[18px] transition-colors',
          active ? 'fill-danger stroke-danger' : 'fill-transparent stroke-ink-2',
        )}
      />
      {variant === 'inline' && (active ? t('saved') : t('save'))}
    </button>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" aria-hidden className={className}>
      <path d="M12 21c-4.8-3.6-8-6.7-8-10.2C4 8 6 6 8.5 6c1.4 0 2.7.7 3.5 1.8C12.8 6.7 14.1 6 15.5 6 18 6 20 8 20 10.8c0 3.5-3.2 6.6-8 10.2z" />
    </svg>
  );
}
