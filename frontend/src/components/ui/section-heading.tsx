import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeadingProps {
  /** Two-digit editorial catalogue index, e.g. "01" — decorative (aria-hidden).
   *  When omitted, a gold "§" section mark is shown instead (in-page sections). */
  index?: string;
  title: string;
  /** Optional trailing control (e.g. a "view all" link), baseline-aligned right. */
  action?: ReactNode;
  /** 'lg' — full-width page sections (default); 'sm' — in-page subsections. */
  size?: 'lg' | 'sm';
  className?: string;
}

/**
 * Paper Lot section header: a gold catalogue index (№01) or section mark (§) +
 * editorial title, closed by a hairline rule — the section-level echo of the
 * listing card's ruled "ВЖИВАНИЙ · LOT" top bar. Keeps every storefront section
 * in one voice.
 */
export function SectionHeading({
  index,
  title,
  action,
  size = 'lg',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'rule-draw flex flex-wrap items-end justify-between gap-x-6 gap-y-2',
        size === 'lg' ? 'pb-3' : 'pb-2.5',
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden
          className={cn(
            'font-mono font-bold tracking-[0.18em] text-lot-gold',
            size === 'lg' ? 'text-[0.6875rem]' : 'text-[0.625rem]',
          )}
        >
          {index ? `№${index}` : '§'}
        </span>
        <h2
          className={cn(
            'font-heading font-extrabold tracking-editorial text-ink',
            size === 'lg' ? 'text-title-lg' : 'text-section',
          )}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
