import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { parseCursorNav } from '@/lib/admin/cursor-stack';
import { formatRelativeDay } from '@/lib/admin/relative-date';
import {
  presentAuditAction,
  shortId,
  sliceByPeriod,
  type AuditPeriod,
  type AuditRow,
} from '@/lib/admin/audit-format';
import { AuditFilters } from '@/components/admin/audit/audit-filters';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Pager } from '@/components/admin/ui/pager';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const TONE_CLS: Record<string, string> = {
  accent: 'bg-accent/[0.08] text-accent-hover',
  success: 'bg-st-published-bg text-st-published-fg',
  danger: 'bg-st-sold-bg text-st-sold-fg',
  warning: 'bg-st-reserved-bg text-st-reserved-fg',
  neutral: 'bg-st-draft-bg text-ink-2',
};

interface SearchParams {
  entityType?: string;
  period?: string;
  cursor?: string;
  stack?: string;
}

/** Handoff 1i — read-only «хто · що · над чим · коли». Admin-only. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const auth = await requireServerToken('/admin/audit');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const [params, t, locale] = await Promise.all([
    searchParams,
    getTranslations('admin'),
    getLocale(),
  ]);
  const period: AuditPeriod =
    params.period === '30' || params.period === 'all' ? params.period : '7';
  const entityType = params.entityType || undefined;
  const nav = parseCursorNav(params);

  const [page, users] = await Promise.all([
    adminApi.listAudit(
      { entityType, cursor: nav.cursor, limit: String(PAGE_SIZE) },
      { accessToken: auth.accessToken },
    ),
    // Actor emails: the log stores ids; the team list is tiny — join client-side.
    adminApi.listUsers({ accessToken: auth.accessToken }).catch(() => []),
  ]);

  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const rows = page.items as unknown as AuditRow[];
  const { items, truncated } = sliceByPeriod(rows, period);
  const nextCursor = truncated ? null : (page.nextCursor as string | null);
  const labels = { today: t('common.today'), yesterday: t('common.yesterday') };

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-[22px] md:py-5">
          <h1 className="font-heading text-[20px] font-extrabold tracking-tight">
            {t('audit.title')}
          </h1>
          <AuditFilters entityType={entityType} period={period} />
        </div>

        {items.length === 0 ? (
          <EmptyState title={t('audit.empty')} />
        ) : (
          <ul>
            {items.map((row) => {
              const p = presentAuditAction(row.action);
              const actor =
                (row.actorId && emailById.get(row.actorId)) ||
                row.actorRole ||
                t('audit.system');
              const target = shortId(row.entityId);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-[13px] border-b border-line/60 px-4 py-[13px] last:border-b-0 md:px-[22px]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] text-[13px]',
                      TONE_CLS[p.tone],
                    )}
                  >
                    {p.glyph}
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink-2">
                    <b className="font-bold text-ink">{actor}</b>{' '}
                    {p.labelKey === 'fallback'
                      ? t('audit.action.fallback', { action: row.action })
                      : t(`audit.action.${p.labelKey}` as never)}
                    {target && <b className="font-semibold text-ink"> {target}</b>}
                  </p>
                  <time
                    dateTime={row.createdAt}
                    className="flex-none whitespace-nowrap text-[12px] font-medium text-ink-3"
                  >
                    {formatRelativeDay(row.createdAt, labels, locale)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line">
          <Pager
            basePath="/admin/audit"
            filters={{ entityType, period: period === '7' ? undefined : period }}
            nav={nav}
            nextCursor={nextCursor}
            shownCount={items.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>
    </div>
  );
}
