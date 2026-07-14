import { cn } from '@/lib/cn';

export type ListingAvailability = 'available' | 'reserved' | 'sold';

const AVAILABILITY: Record<ListingAvailability, string> = {
  available: 'bg-ok-bg text-ok',
  reserved: 'bg-warn/[0.12] text-warn-strong',
  sold: 'bg-danger-bg text-danger',
};

interface StatusBadgeProps {
  status: ListingAvailability;
  children: React.ReactNode;
  className?: string;
}

/**
 * Availability badge for the detail page header (handoff: "● Доступний").
 * Colours are fixed status tokens — never the brand accent.
 */
export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sub font-semibold',
        AVAILABILITY[status],
        className,
      )}
    >
      <span aria-hidden className="text-[8px] leading-none">
        ●
      </span>
      {children}
    </span>
  );
}

interface ConditionBadgeProps {
  condition: 'new' | 'used' | 'damaged';
  children: React.ReactNode;
  className?: string;
}

/**
 * Grid-card condition badge (top-left over the photo): "Новий" = accent on
 * white text, "Вживаний" = translucent white over the photo.
 */
export function ConditionBadge({ condition, children, className }: ConditionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-btn px-2.5 py-1 text-label font-semibold',
        condition === 'new'
          ? 'bg-accent text-on-accent'
          : 'bg-surface/85 text-ink-2 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </span>
  );
}
