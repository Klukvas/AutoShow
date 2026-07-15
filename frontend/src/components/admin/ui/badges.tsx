import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { AdminLead, ListingStatus } from '@/lib/api/admin';

/**
 * Admin handoff badges. Listing lifecycle pairs are fixed theme tokens
 * (--st-*); lead types are accent-derived (soft accent surfaces built with
 * alpha so ANY configured brand colour works — never hardcode accent hexes).
 */
const STATUS_CLS: Record<ListingStatus, string> = {
  draft: 'bg-st-draft-bg text-st-draft-fg',
  published: 'bg-st-published-bg text-st-published-fg',
  reserved: 'bg-st-reserved-bg text-st-reserved-fg',
  sold: 'bg-st-sold-bg text-st-sold-fg',
  archived: 'bg-st-archived-bg text-st-archived-fg',
};

export function ListingStatusBadge({
  status,
  className,
}: {
  status: ListingStatus;
  className?: string;
}) {
  const t = useTranslations('admin.status');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[6px] px-2.5 py-1 text-[11px] font-bold leading-none',
        STATUS_CLS[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}

const LEAD_TYPE_CLS: Record<AdminLead['type'], string> = {
  callback: 'bg-st-draft-bg text-ink-2',
  message: 'bg-accent/[0.10] text-accent',
  test_drive: 'bg-accent/[0.08] text-accent-hover',
  // Money-adjacent leads stand out: sell intake green, credit amber.
  sell_request: 'bg-ok-bg text-ok',
  credit: 'bg-warn/[0.12] text-warn-strong',
};

export function LeadTypeBadge({
  type,
  className,
}: {
  type: AdminLead['type'];
  className?: string;
}) {
  const t = useTranslations('admin.leadType');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] px-2 py-[3px] text-[10.5px] font-bold leading-none',
        LEAD_TYPE_CLS[type],
        className,
      )}
    >
      {t(type)}
    </span>
  );
}

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations('admin.team');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] px-2 py-[3px] text-[10.5px] font-bold leading-none',
        isActive
          ? 'bg-st-published-bg text-st-published-fg'
          : 'bg-st-archived-bg text-st-archived-fg',
      )}
    >
      {t(isActive ? 'active' : 'blocked')}
    </span>
  );
}
