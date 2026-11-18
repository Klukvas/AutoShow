import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Banner } from '@/components/admin/ui/banner';
import {
  billingNotice,
  formatBillingDate,
  hasBillingDetails,
  type BillingStatus,
} from '@/lib/admin/billing';

/** Admin-only payment reminder above every dashboard page (editors never get details). */
export function BillingBanner({ status }: { status: BillingStatus | null }) {
  const t = useTranslations('admin.billing');
  const locale = useLocale();
  const notice = billingNotice(status);
  if (!notice || !hasBillingDetails(status)) return null;

  const text =
    notice.kind === 'dueSoon'
      ? t('banner.dueSoon', {
          date: formatBillingDate(status.paidUntil, locale),
          days: status.daysLeft,
        })
      : t('banner.overdue', { date: formatBillingDate(status.blockAt, locale) });

  return (
    <Banner
      tone={notice.tone}
      className="mb-5"
      action={
        <Link
          href="/admin/billing"
          className="focus-ring inline-flex h-8 items-center rounded-none border border-current px-3 text-[0.75rem] font-medium"
        >
          {t('banner.action')}
        </Link>
      }
    >
      {text}
    </Banner>
  );
}
