import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import {
  nextPageParams,
  pageOffset,
  prevPageParams,
  type CursorNav,
} from '@/lib/admin/cursor-stack';

interface PagerProps {
  basePath: string;
  /** Non-pagination filters to preserve in links (q, status, …). */
  filters: Record<string, string | undefined>;
  nav: CursorNav;
  nextCursor: string | null;
  shownCount: number;
  pageSize: number;
  total?: number;
}

function href(basePath: string, filters: PagerProps['filters'], page: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  for (const [k, v] of Object.entries(page)) params.set(k, v);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Cursor pagination footer: «Показано N–M [з T]» + Назад / Далі. */
export function Pager({
  basePath,
  filters,
  nav,
  nextCursor,
  shownCount,
  pageSize,
  total,
}: PagerProps) {
  const t = useTranslations('admin.common');
  const from = pageOffset(nav, pageSize);
  const to = from + shownCount - 1;
  const prev = prevPageParams(nav);

  const btn =
    'inline-flex h-[34px] items-center rounded-[8px] border border-line-input bg-surface px-3.5 text-[12.5px] font-semibold focus-ring';

  return (
    <div className="flex items-center justify-between px-4 py-3 md:px-[18px]">
      <span className="text-[12.5px] font-medium text-ink-3">
        {shownCount === 0
          ? null
          : total !== undefined
            ? t('shownOf', { from, to, total })
            : t('shown', { from, to })}
      </span>
      <div className="flex gap-2">
        {prev ? (
          <Link href={href(basePath, filters, prev)} className={cn(btn, 'text-ink hover:border-line-hover')}>
            ← {t('back')}
          </Link>
        ) : (
          <span className={cn(btn, 'cursor-not-allowed text-ink-3/70')}>
            ← {t('back')}
          </span>
        )}
        {nextCursor ? (
          <Link
            href={href(basePath, filters, nextPageParams(nav, nextCursor))}
            className={cn(btn, 'text-ink hover:border-line-hover')}
          >
            {t('next')} →
          </Link>
        ) : (
          <span className={cn(btn, 'cursor-not-allowed text-ink-3/70')}>
            {t('next')} →
          </span>
        )}
      </div>
    </div>
  );
}
