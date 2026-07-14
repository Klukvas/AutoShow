import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { adminApi, type AdminLead } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { formatRelativeDay, formatRelativeDateTime } from '@/lib/admin/relative-date';
import { LeadTypeBadge } from '@/components/admin/ui/badges';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { LeadStatusSegments } from '@/components/admin/leads/lead-status-segments';

export const dynamic = 'force-dynamic';

const PAGE_LIMIT = 50;

interface SearchParams {
  id?: string;
  cursor?: string;
}

/**
 * Handoff 1f — two-pane inbox. Desktop: list (400px) + detail; mobile:
 * master → detail via the same URL param (?id=). Selection is a plain link,
 * so back/forward and deep links work for free.
 */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [auth, params, t, locale] = await Promise.all([
    requireServerToken('/admin/leads'),
    searchParams,
    getTranslations('admin'),
    getLocale(),
  ]);

  const [page, newPage] = await Promise.all([
    adminApi.listLeads(
      { limit: String(PAGE_LIMIT), cursor: params.cursor },
      { accessToken: auth.accessToken },
    ),
    // Header badge counts ALL new leads, not just the current page.
    adminApi
      .listLeads({ status: 'new', limit: '1' }, { accessToken: auth.accessToken })
      .catch(() => null),
  ]);
  const newCount = newPage?.total ?? page.items.filter((l) => l.status === 'new').length;

  const selected: AdminLead | undefined = params.id
    ? page.items.find((l) => l.id === params.id)
    : undefined;
  // A bookmarked ?id= may point at a lead outside the current cursor window —
  // the detail pane must say so instead of the neutral "select a lead" state.
  const selectedMissing = Boolean(params.id) && !selected;
  const labels = { today: t('common.today'), yesterday: t('common.yesterday') };

  const listPane = (
    <div
      className={cn(
        'flex-none border-line bg-surface-2 md:w-[400px] md:border-r',
        // Mobile: hide the list when a lead is open.
        selected ? 'hidden md:block' : 'block',
      )}
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-[18px]">
        <h1 className="font-heading text-[20px] font-extrabold tracking-tight">
          {t('leads.title')}
        </h1>
        {newCount > 0 && (
          <span className="rounded-full bg-accent/[0.08] px-[9px] py-[3px] text-[11px] font-bold text-accent-hover">
            {t('leads.newCount', { count: newCount })}
          </span>
        )}
      </div>
      {page.items.length === 0 ? (
        <EmptyState title={t('leads.emptyTitle')} body={t('leads.emptyBody')} />
      ) : (
        <ul>
          {page.items.map((lead) => {
            const active = lead.id === selected?.id;
            const isNew = lead.status === 'new';
            return (
              <li key={lead.id}>
                <Link
                  href={`/admin/leads?id=${lead.id}${params.cursor ? `&cursor=${encodeURIComponent(params.cursor)}` : ''}`}
                  aria-current={active ? true : undefined}
                  className={cn(
                    'focus-ring flex gap-[11px] border-t border-line/60 px-5 py-[13px] transition-none',
                    active ? 'bg-accent/[0.08]' : 'hover:bg-ink/[0.02]',
                  )}
                >
                  <span
                    aria-label={isNew ? t('leads.newDot') : undefined}
                    aria-hidden={isNew ? undefined : true}
                    className={cn(
                      'mt-1.5 h-2 w-2 flex-none rounded-full',
                      isNew ? 'bg-accent' : 'bg-line-input',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-bold text-ink">{lead.name}</span>
                      <span className="flex-none text-[11px] font-medium text-ink-3">
                        {formatRelativeDay(lead.createdAt, labels, locale)}
                      </span>
                    </span>
                    <span className="mt-[3px] flex items-center gap-[7px]">
                      <LeadTypeBadge type={lead.type} />
                      {lead.listing && (
                        <span className="truncate text-[12px] font-medium text-ink-2">
                          {lead.listing.title}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[12px] font-medium text-ink-3 tabular">
                      {lead.phone}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {page.nextCursor && (
        <div className="border-t border-line/60 p-3 text-center">
          <Link
            href={`/admin/leads?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="focus-ring inline-flex h-[34px] items-center rounded-[8px] border border-line-input bg-surface px-3.5 text-[12.5px] font-semibold text-ink"
          >
            {t('common.next')} →
          </Link>
        </div>
      )}
    </div>
  );

  const detailPane = (
    <div
      className={cn(
        'min-w-0 flex-1 px-5 py-6 md:px-[26px]',
        selected ? 'block' : 'hidden md:block',
      )}
    >
      {selected ? (
        <LeadDetail lead={selected} locale={locale} labels={labels} backHref="/admin/leads" />
      ) : selectedMissing ? (
        <EmptyState
          title={t('leads.notFoundTitle')}
          body={t('leads.notFoundBody')}
          action={
            <Link
              href="/admin/leads"
              className="focus-ring inline-flex h-10 items-center rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {t('leads.backToList')}
            </Link>
          }
        />
      ) : (
        <EmptyState
          title={t('leads.selectPrompt')}
          icon={
            <svg
              viewBox="0 0 16 16"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
              <path d="m2 4 6 5 6-5" />
            </svg>
          }
        />
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface md:flex md:min-h-[520px]">
      {listPane}
      {detailPane}
    </div>
  );
}

async function LeadDetail({
  lead,
  locale,
  labels,
  backHref,
}: {
  lead: AdminLead;
  locale: string;
  labels: { today: string; yesterday: string };
  backHref: string;
}) {
  const t = await getTranslations('admin');
  const source = lead.sourceUrl ? stripOrigin(lead.sourceUrl) : null;

  return (
    <div>
      <Link
        href={backHref}
        className="focus-ring mb-3 inline-flex items-center gap-1 rounded-[6px] text-[12.5px] font-semibold text-ink-2 md:hidden"
      >
        ← {t('leads.backToList')}
      </Link>

      <div className="flex items-center gap-2.5">
        <LeadTypeBadge type={lead.type} className="px-[9px] py-[3px] text-[11px]" />
        {lead.status === 'new' && (
          <>
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[12px] font-semibold text-accent">{t('leadStatus.new')}</span>
          </>
        )}
      </div>
      <h2 className="mt-2 font-heading text-[22px] font-extrabold tracking-tight md:text-[24px]">
        {lead.name}
      </h2>
      <p className="mb-[22px] mt-0.5 text-[13px] font-medium text-ink-3">
        {formatRelativeDateTime(lead.createdAt, labels, locale)}
        {source && <> · {t('leads.source', { url: source })}</>}
      </p>

      <div className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <DetailCard label={t('leads.phone')}>
          <a
            href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
            className="focus-ring rounded-[4px] tabular hover:text-accent"
          >
            {lead.phone}
          </a>
        </DetailCard>
        {lead.email && (
          <DetailCard label={t('leads.email')}>
            <a
              href={`mailto:${encodeURIComponent(lead.email)}`}
              className="focus-ring break-all rounded-[4px] hover:text-accent"
            >
              {lead.email}
            </a>
          </DetailCard>
        )}
        {lead.listing && (
          <DetailCard label={t('leads.car')} wide>
            <Link
              href={`/admin/listings/${lead.listing.id}/edit`}
              className="focus-ring rounded-[4px] hover:text-accent"
            >
              {lead.listing.title}
            </Link>
          </DetailCard>
        )}
        {lead.message && (
          <DetailCard label={t('leads.message')} wide>
            <span className="whitespace-pre-wrap text-[13.5px] font-normal leading-relaxed text-ink">
              {lead.message}
            </span>
          </DetailCard>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LeadStatusSegments id={lead.id} status={lead.status} />
        <a
          href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
          className="focus-ring ml-auto inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="currentColor">
            <path d="M3.2 1.8c.4-.4 1-.4 1.4 0l1.9 1.9c.4.4.4 1 0 1.4l-.9.9a.6.6 0 0 0-.1.7 9.4 9.4 0 0 0 3.8 3.8c.2.1.5.1.7-.1l.9-.9c.4-.4 1-.4 1.4 0l1.9 1.9c.4.4.4 1 0 1.4l-1 1c-.6.6-1.5.9-2.3.6-4.2-1.3-7.6-4.7-8.9-8.9-.3-.8 0-1.7.6-2.3l.6-1.4Z" />
          </svg>
          {t('leads.call')}
        </a>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn('rounded-[11px] border border-line p-3.5', wide && 'sm:col-span-2')}>
      <div className="text-[11.5px] font-medium text-ink-3">{label}</div>
      <div className="mt-[3px] text-[15px] font-bold text-ink">{children}</div>
    </div>
  );
}

/**
 * «/cars/porsche-911» instead of the full origin — the handoff shows paths.
 * The base makes relative sourceUrls parse too; anything unparseable renders
 * as a dash rather than echoing raw user input.
 */
function stripOrigin(url: string): string {
  try {
    const u = new URL(url, 'https://relative.invalid');
    return `${u.pathname}${u.search}` || '—';
  } catch {
    return '—';
  }
}
