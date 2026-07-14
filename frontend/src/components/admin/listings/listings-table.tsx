'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminListing } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { formatMoney } from '@/lib/format';
import { Banner } from '@/components/admin/ui/banner';
import { ListingStatusBadge } from '@/components/admin/ui/badges';
import { CarThumb } from '@/components/admin/ui/car-thumb';
import { Dialog } from '@/components/admin/ui/dialog';
import { RowMenu } from '@/components/admin/ui/row-menu';

interface ListingsTableProps {
  items: AdminListing[];
  canDelete: boolean;
  /** Table (md+) and cards (mobile) render from the same data + actions. */
}

/** Cover thumb for the row preview; any processed photo beats the placeholder. */
function coverThumbUrl(listing: AdminListing): string | null {
  const media = listing.media ?? [];
  return (
    media.find((m) => m.isCover && m.thumbUrl)?.thumbUrl ??
    media.find((m) => m.thumbUrl)?.thumbUrl ??
    null
  );
}

function MediaCount({ listing }: { listing: AdminListing }) {
  const t = useTranslations('admin.listings');
  const media = listing.media ?? [];
  const failed = media.filter((m) => m.status === 'failed').length;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2"
      aria-label={t('mediaCount', { count: media.length })}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="h-3.5 w-3.5 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        <circle cx="5.5" cy="6.5" r="1.3" />
        <path d="m2 12 3.8-3.5 3 2.6 2.6-2.3 2.6 2.6" />
      </svg>
      {media.length}
      {failed > 0 && (
        <span aria-hidden className="text-danger">
          ⚠
        </span>
      )}
    </span>
  );
}

export function ListingsTable({ items, canDelete }: ListingsTableProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [toDelete, setToDelete] = useState<AdminListing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuFor = (l: AdminListing) => [
    { label: t('listings.menuEdit'), onSelect: () => router.push(`/admin/listings/${l.id}/edit`) },
    ...(['published', 'reserved', 'sold'].includes(l.status)
      ? [
          {
            label: t('listings.menuView'),
            onSelect: () => window.open(`/cars/${l.slug}`, '_blank', 'noopener,noreferrer'),
          },
        ]
      : []),
    ...(canDelete
      ? [{ label: t('listings.menuDelete'), danger: true, onSelect: () => setToDelete(l) }]
      : []),
  ];

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      await adminApi.deleteListing(toDelete.id, { accessToken });
      setToDelete(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {error && (
        <Banner tone="error" className="mb-3">
          {error}
        </Banner>
      )}

      {/* Desktop table */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="bg-thead text-left text-[11px] font-bold uppercase tracking-[0.05em] text-ink-3">
            <th className="rounded-tl-[11px] px-[18px] py-3 font-bold">
              {t('listings.colListing')}
            </th>
            <th className="w-[140px] px-2 py-3 font-bold">{t('listings.colStatus')}</th>
            <th className="w-[110px] px-2 py-3 font-bold">{t('listings.colPrice')}</th>
            <th className="w-[80px] px-2 py-3 font-bold">{t('listings.colYear')}</th>
            <th className="w-[90px] px-2 py-3 font-bold">{t('listings.colMedia')}</th>
            <th className="w-[56px] rounded-tr-[11px] px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr
              key={l.id}
              className="border-t border-line/70 transition-none first:border-t-0 hover:bg-ink/[0.02]"
            >
              <td className="px-[18px] py-[11px]">
                <div className="flex min-w-0 items-center gap-[11px]">
                  <CarThumb src={coverThumbUrl(l)} className="h-[38px] w-[50px] rounded-[7px]" />
                  <Link
                    href={`/admin/listings/${l.id}/edit`}
                    className="focus-ring truncate rounded-[4px] text-[13.5px] font-semibold text-ink hover:text-accent"
                  >
                    {l.title}
                  </Link>
                </div>
              </td>
              <td className="px-2 py-[11px]">
                <ListingStatusBadge status={l.status} />
              </td>
              <td className="px-2 py-[11px] text-[13px] font-semibold tabular">
                {formatMoney(l.priceAmount, l.priceCurrency)}
              </td>
              <td className="px-2 py-[11px] text-[13px] font-medium text-ink-2 tabular">
                {l.year}
              </td>
              <td className="px-2 py-[11px]">
                <MediaCount listing={l} />
              </td>
              <td className="px-2 py-[5px] text-right">
                <RowMenu items={menuFor(l)} className="ml-auto w-fit" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards (handoff 1c) */}
      <ul className="flex flex-col gap-[11px] p-3 md:hidden">
        {items.map((l) => (
          <li
            key={l.id}
            className="relative flex items-center gap-3 rounded-[12px] border border-line bg-surface p-[11px]"
          >
            <CarThumb src={coverThumbUrl(l)} className="h-14 w-[74px] rounded-[8px]" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/listings/${l.id}/edit`}
                className="focus-ring block truncate rounded-[4px] text-[14px] font-semibold text-ink after:absolute after:inset-0 after:content-['']"
              >
                {l.title}
              </Link>
              <div className="mt-[5px] flex items-center gap-2">
                <ListingStatusBadge status={l.status} className="px-2 py-[3px] text-[10.5px]" />
                <MediaCount listing={l} />
              </div>
              <div className="mt-1.5 font-heading text-[14px] font-bold tabular">
                {formatMoney(l.priceAmount, l.priceCurrency)}{' '}
                <span className="font-sans text-[12px] font-medium text-ink-3">· {l.year}</span>
              </div>
            </div>
            {/* Menu sits above the stretched row link. */}
            <div className="relative z-10 self-start">
              <RowMenu items={menuFor(l)} />
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={toDelete !== null}
        onClose={() => (deleting ? null : setToDelete(null))}
        title={t('listings.deleteTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={deleting}
              className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="focus-ring h-10 rounded-[9px] bg-danger px-4 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {deleting ? t('common.saving') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
          {toDelete && t('listings.deleteBody', { title: toDelete.title })}
        </p>
      </Dialog>
    </>
  );
}
