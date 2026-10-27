'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
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
import { useToast } from '@/components/admin/ui/toast';

interface ListingsTableProps {
  items: AdminListing[];
  canDelete: boolean;
  /** Table (md+) and cards (mobile) render from the same data + actions. */
}

/** Archive is a legal, reversible transition (`archived → publish`) — undo, not a confirm. */
const UNDO_WINDOW_MS = 8_000;

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
      className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-2"
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
  const { toast } = useToast();
  const [toDelete, setToDelete] = useState<AdminListing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  /** One undo in flight at a time — a second click must not republish twice. */
  const undoing = useRef(false);

  const allSelected = items.length > 0 && items.every((l) => selected.has(l.id));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((l) => l.id)));

  /**
   * Undo of the bulk archive: republish exactly the ids that were archived
   * (`archived → publish` is an allowed transition). Per-id results mean a
   * listing changed elsewhere fails alone; those are surfaced in the banner.
   */
  const undoArchive = async (ids: string[]) => {
    if (undoing.current || ids.length === 0) return;
    undoing.current = true;
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      const res = await adminApi.bulkListings({ ids, action: 'publish' }, { accessToken });
      toast(
        t('listings.bulkDone', { ok: res.succeeded, total: ids.length }),
        res.succeeded > 0 ? 'success' : 'error',
      );
      if (res.failed > 0) {
        const firstError = res.results.find((r) => !r.ok)?.error;
        setError(firstError ?? t('common.errorTitle'));
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) setError(t('common.sessionExpired'));
      else if (err instanceof ApiClientError && err.status === 429)
        setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError && err.status === 409)
        setError(t('common.errorTitle'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      undoing.current = false;
    }
  };

  /**
   * One server call applies the action to every selected id and returns a
   * per-id result — publish readiness (422) or an invalid transition fails
   * that id only, never the whole batch. We surface succeeded/failed counts
   * and refresh to show the true state.
   */
  const runBulk = async (action: 'publish' | 'archive' | 'delete') => {
    if (bulkRunning || selected.size === 0) return;
    setBulkRunning(true);
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      const ids = items.filter((l) => selected.has(l.id)).map((l) => l.id);
      // Status BEFORE the call — the only source for a truthful rollback.
      const statusBefore = new Map(items.map((l) => [l.id, l.status] as const));
      const res = await adminApi.bulkListings({ ids, action }, { accessToken });
      // Only ids the server actually archived can be undone; failures stay archived-free.
      const archived = action === 'archive' ? res.results.filter((r) => r.ok).map((r) => r.id) : [];
      // Undo runs `publish`, so it is a real rollback only for listings that were
      // public before the archive. A draft/reserved listing would be published for
      // the first time (draft → public site, reserved → published), so those are
      // excluded; a mixed batch offers Undo for the published subset only.
      const republishable = archived.filter((id) => statusBefore.get(id) === 'published');
      if (archived.length > 0) {
        toast(
          t('listings.bulkArchived', { count: archived.length }),
          'success',
          republishable.length > 0
            ? {
                label: t('common.undo'),
                onAction: () => void undoArchive(republishable),
                durationMs: UNDO_WINDOW_MS,
              }
            : undefined,
        );
      } else {
        toast(
          t('listings.bulkDone', { ok: res.succeeded, total: ids.length }),
          res.succeeded > 0 ? 'success' : 'error',
        );
      }
      if (res.failed > 0) {
        const firstError = res.results.find((r) => !r.ok)?.error;
        if (firstError) setError(firstError);
      }
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setBulkRunning(false);
    }
  };

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

      {/* Bulk toolbar (desktop selection) */}
      {selected.size > 0 && (
        <div className="mb-3 hidden flex-wrap items-center gap-3 rounded-none border border-line bg-surface px-4 py-2.5 md:flex">
          <span className="text-[0.8125rem] font-medium text-ink">
            {t('listings.bulkSelected', { count: selected.size })}
          </span>
          <button
            type="button"
            onClick={() => void runBulk('publish')}
            disabled={bulkRunning}
            className="focus-ring h-9 rounded-none bg-accent px-3.5 text-[0.78125rem] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {bulkRunning ? t('common.saving') : t('listings.bulkPublish')}
          </button>
          <button
            type="button"
            onClick={() => void runBulk('archive')}
            disabled={bulkRunning}
            className="focus-ring h-9 rounded-none bg-ink px-3.5 text-[0.78125rem] font-medium text-bg disabled:opacity-50"
          >
            {bulkRunning ? t('common.saving') : t('listings.bulkArchive')}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkRunning}
              className="focus-ring h-9 rounded-none border border-danger-line px-3.5 text-[0.78125rem] font-medium text-danger disabled:opacity-50"
            >
              {t('listings.bulkDelete')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={bulkRunning}
            className="focus-ring h-9 rounded-none border border-line-input bg-surface px-3.5 text-[0.78125rem] font-medium text-ink"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Desktop table */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="bg-thead text-left text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-ink-3">
            <th className="w-[44px] rounded-tl-[11px] py-3 pl-[18px]">
              <input
                type="checkbox"
                aria-label={t('listings.bulkSelectAll')}
                checked={allSelected}
                disabled={items.length === 0}
                onChange={toggleAll}
                className="h-4 w-4 accent-[rgb(var(--accent))]"
              />
            </th>
            <th className="px-[18px] py-3 font-medium">{t('listings.colListing')}</th>
            <th className="w-[140px] px-2 py-3 font-medium">{t('listings.colStatus')}</th>
            <th className="w-[110px] px-2 py-3 font-medium">{t('listings.colPrice')}</th>
            <th className="w-[80px] px-2 py-3 font-medium">{t('listings.colYear')}</th>
            <th className="w-[100px] px-2 py-3 font-medium">{t('listings.colViews')}</th>
            <th className="w-[90px] px-2 py-3 font-medium">{t('listings.colMedia')}</th>
            <th className="w-[56px] rounded-tr-[11px] px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr
              key={l.id}
              className="border-t border-line/70 transition-none first:border-t-0 hover:bg-ink/[0.02]"
            >
              <td className="py-[11px] pl-[18px]">
                <input
                  type="checkbox"
                  aria-label={t('listings.bulkSelectRow', { title: l.title })}
                  checked={selected.has(l.id)}
                  onChange={() => toggleRow(l.id)}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
              </td>
              <td className="px-[18px] py-[11px]">
                <div className="flex min-w-0 items-center gap-[11px]">
                  <CarThumb src={coverThumbUrl(l)} className="h-[38px] w-[50px] rounded-none" />
                  <Link
                    href={`/admin/listings/${l.id}/edit`}
                    className="focus-ring truncate rounded-none text-[0.84375rem] font-medium text-ink hover:text-accent"
                  >
                    {l.title}
                  </Link>
                </div>
              </td>
              <td className="px-2 py-[11px]">
                <ListingStatusBadge status={l.status} />
              </td>
              <td className="px-2 py-[11px] text-[0.8125rem] font-medium tabular">
                {formatMoney(l.priceAmount, l.priceCurrency)}
              </td>
              <td className="px-2 py-[11px] text-[0.8125rem] font-medium text-ink-2 tabular">
                {l.year}
              </td>
              <td className="px-2 py-[11px] text-[0.8125rem] font-medium text-ink-2 tabular">
                {l.viewsCount ?? 0}
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
            className="relative flex items-center gap-3 rounded-none border border-line bg-surface p-[11px]"
          >
            <CarThumb src={coverThumbUrl(l)} className="h-14 w-[74px] rounded-none" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/listings/${l.id}/edit`}
                className="focus-ring block truncate rounded-none text-[0.875rem] font-medium text-ink after:absolute after:inset-0 after:content-['']"
              >
                {l.title}
              </Link>
              <div className="mt-[5px] flex items-center gap-2">
                <ListingStatusBadge status={l.status} className="px-2 py-[3px] text-[0.65625rem]" />
                <MediaCount listing={l} />
              </div>
              <div className="mt-1.5 font-heading text-[0.875rem] font-medium tabular">
                {formatMoney(l.priceAmount, l.priceCurrency)}{' '}
                <span className="font-sans text-[0.75rem] font-medium text-ink-3">· {l.year}</span>
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
              className="focus-ring h-10 rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="focus-ring h-10 rounded-none platform-destructive px-4 text-[0.8125rem] font-medium disabled:opacity-60"
            >
              {deleting ? t('common.saving') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-[0.84375rem] font-medium leading-relaxed text-ink-2">
          {toDelete && t('listings.deleteBody', { title: toDelete.title })}
        </p>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onClose={() => (bulkRunning ? null : setBulkDeleteOpen(false))}
        title={t('listings.bulkDeleteTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkRunning}
              className="focus-ring h-10 rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void runBulk('delete')}
              disabled={bulkRunning}
              className="focus-ring h-10 rounded-none platform-destructive px-4 text-[0.8125rem] font-medium disabled:opacity-60"
            >
              {bulkRunning ? t('common.saving') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-[0.84375rem] font-medium leading-relaxed text-ink-2">
          {t('listings.bulkDeleteBody', { count: selected.size })}
        </p>
      </Dialog>
    </>
  );
}
