import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { adminApi, type AnalyticsSummary } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { getSiteBranding } from '@/lib/branding/resolve';
import { formatMoney } from '@/lib/format';
import { ListingStatusBadge } from '@/components/admin/ui/badges';
import { SectionCard } from '@/components/admin/ui/section-card';
import type { ListingStatus } from '@/lib/api/admin';

export const dynamic = 'force-dynamic';

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-3">{label}</div>
      <div
        className={`tabular mt-1.5 font-heading text-[26px] font-extrabold ${accent ? 'text-accent' : 'text-ink'}`}
      >
        {value}
      </div>
    </div>
  );
}

const MONTH_LABELS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

function monthLabel(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return `${MONTH_LABELS[idx] ?? month} ’${month.slice(2, 4)}`;
}

/** Dashboard (handoff-consistent cards): sales, commissions, leads, views. */
export default async function AdminDashboardPage() {
  const [auth, t, branding] = await Promise.all([
    requireServerToken('/admin'),
    getTranslations('admin.dashboard'),
    getSiteBranding().catch(() => null),
  ]);
  const summary: AnalyticsSummary = await adminApi.getAnalyticsSummary({
    accessToken: auth.accessToken,
  });

  const currency = branding?.defaultCurrency ?? 'USD';
  const money = (v: string) => formatMoney(v, currency);
  const maxMonthCommission = Math.max(
    1,
    ...summary.salesByMonth.map((m) => Number(m.commission)),
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-5">
        <h1 className="font-heading text-[22px] font-extrabold text-ink">{t('title')}</h1>
        <p className="mt-0.5 text-[13px] font-medium text-ink-3">{t('subtitle')}</p>
      </div>

      {/* Sales & money */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t('cardSold30')} value={String(summary.sales.last30d)} />
        <MetricCard label={t('cardCommission30')} value={money(summary.sales.commission30d)} accent />
        <MetricCard label={t('cardCommissionTotal')} value={money(summary.sales.commissionTotal)} />
        <MetricCard label={t('cardPipeline')} value={money(summary.sales.commissionPipeline)} />
      </div>

      {/* Inventory & demand */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t('cardActive')} value={String(summary.listings.published ?? 0)} />
        <MetricCard label={t('cardReserved')} value={String(summary.listings.reserved ?? 0)} />
        <MetricCard
          label={t('cardLeads30')}
          value={String(summary.leads.last30d)}
        />
        <MetricCard label={t('cardViews')} value={String(summary.views.total)} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Sales by month (CSS bars, no chart lib) */}
        <SectionCard title={t('salesByMonth')}>
          {summary.salesByMonth.length === 0 ? (
            <p className="text-[13px] font-medium text-ink-3">{t('empty')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {summary.salesByMonth.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="tabular w-[64px] flex-none text-[12px] font-bold text-ink-2">
                    {monthLabel(m.month)}
                  </span>
                  <div className="h-[22px] flex-1 overflow-hidden rounded-[6px] bg-surface-2">
                    <div
                      className="flex h-full items-center rounded-[6px] bg-accent/85 px-2"
                      style={{
                        width: `${Math.max(6, (Number(m.commission) / maxMonthCommission) * 100)}%`,
                      }}
                    >
                      <span className="tabular whitespace-nowrap text-[11px] font-bold text-on-accent">
                        {money(m.commission)}
                      </span>
                    </div>
                  </div>
                  <span className="tabular w-[68px] flex-none text-right text-[12px] font-semibold text-ink-3">
                    {t('salesCount', { count: m.count })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Top by views */}
        <SectionCard title={t('topViews')}>
          {summary.views.top.length === 0 ? (
            <p className="text-[13px] font-medium text-ink-3">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.views.top.map((item, idx) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/listings/${item.id}/edit`}
                    className="focus-ring flex items-center gap-3 rounded-[9px] px-2 py-2 hover:bg-ink/[0.03]"
                  >
                    <span className="tabular w-5 flex-none text-center text-[13px] font-extrabold text-ink-3">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                      {item.title}
                    </span>
                    <ListingStatusBadge status={item.status as ListingStatus} />
                    <span className="tabular flex-none text-[12.5px] font-bold text-ink-2">
                      {item.viewsCount}{' '}
                      <span className="font-medium text-ink-3">{t('viewsSuffix')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
