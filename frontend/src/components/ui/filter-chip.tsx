'use client';

import { cn } from '@/lib/cn';

interface FilterChipProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Option pill (multi-select facets). Active state is the brand-agnostic
 * accent-soft treatment: alpha of --accent over the surface, accent border,
 * darker accent text — works with any configured brand colour in both themes.
 */
export function FilterChip({ children, active, onClick, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-pill border px-3.5 text-sub font-medium transition-colors focus-ring',
        active
          ? 'border-accent bg-accent/[0.08] text-accent-hover dark:bg-accent/[0.14] dark:text-accent'
          : 'border-line-input bg-surface text-ink-2 hover:border-line-hover hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}
