import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { adminApi, type ListingStatus } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { parseCursorNav } from '@/lib/admin/cursor-stack';
import { ListingsToolbar } from '@/components/admin/listings/listings-toolbar';
import { ListingsTable } from '@/components/admin/listings/listings-table';
import { TopbarAction } from '@/components/admin/topbar-action';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Pager } from '@/components/admin/ui/pager';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
const VALID_STATUSES: ReadonlySet<string> = new Set([
  'draft',
  'published',
  'reserved',
  'sold',
  'archived',
]);

interface SearchParams {
  q?: string;
  status?: string;
  cursor?: string;
  stack?: string;
}

/** Handoff 1b/1c — the panel's start screen. */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [auth, params, t] = await Promise.all([
    requireServerToken('/admin/listings'),
    searchParams,
    getTranslations('admin'),
  ]);

  const q = params.q?.trim() || undefined;
  const status =
    params.status && VALID_STATUSES.has(params.status)
      ? (params.status as ListingStatus)
      : undefined;
  const nav = parseCursorNav(params);
  const hasFilters = Boolean(q || status);

  const [page, draftsPage] = await Promise.all([
    adminApi.listListings(
      { q, status, cursor: nav.cursor, limit: PAGE_SIZE },
      { accessToken: auth.accessToken },
    ),
    // Second lightweight call only feeds the "N чернеток" headline counter.
    adminApi
      .listListings({ status: 'draft', limit: 1 }, { accessToken: auth.accessToken })
      .catch(() => null),
  ]);

  const createBtn = (
    <Link
      href="/admin/listings/new"
      className="focus-ring inline-flex h-[42px] items-center rounded-[10px] bg-accent px-[18px] text-[13.5px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
    >
      {t('listings.create')}
    </Link>
  );

  return (
    <div>
      <TopbarAction>
        <Link
          href="/admin/listings/new"
          className="focus-ring inline-flex h-[34px] items-center rounded-[8px] bg-accent px-[13px] text-[12.5px] font-bold text-on-accent"
        >
          {t('listings.createShort')}
        </Link>
      </TopbarAction>

      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[20px] font-extrabold tracking-tight md:text-[24px]">
            {t('listings.title')}
          </h1>
          {page.total !== undefined && (
            <p className="mt-[3px] text-[13px] font-medium text-ink-3">
              {t('listings.totals', {
                total: page.total,
                drafts: draftsPage?.total ?? 0,
              })}
            </p>
          )}
        </div>
        <div className="hidden md:block">{createBtn}</div>
      </header>

      <ListingsToolbar q={q} status={status} />

      {page.items.length === 0 ? (
        <div className="rounded-[12px] border border-line bg-surface">
          {hasFilters ? (
            <EmptyState title={t('listings.noResultsTitle')} body={t('listings.noResultsBody')} />
          ) : (
            <EmptyState
              title={t('listings.emptyTitle')}
              body={t('listings.emptyBody')}
              action={
                <Link
                  href="/admin/listings/new"
                  className="focus-ring inline-flex h-[42px] items-center rounded-[10px] bg-accent px-[18px] text-[13.5px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
                >
                  {t('listings.emptyCta')}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="overflow-visible rounded-[12px] border border-line bg-surface">
          <ListingsTable items={page.items} canDelete={auth.session.user.role === 'admin'} />
          <div className="border-t border-line">
            <Pager
              basePath="/admin/listings"
              filters={{ q, status }}
              nav={nav}
              nextCursor={page.nextCursor}
              shownCount={page.items.length}
              pageSize={PAGE_SIZE}
              total={page.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
