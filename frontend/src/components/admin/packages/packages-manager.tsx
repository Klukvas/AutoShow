'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminPlacementPackage } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import {
  EMPTY_PACKAGE_DRAFT,
  isPackageDraftValid,
  packageDraftToBody,
  toPackageDraft,
  type PackageDraft,
} from '@/lib/admin/placement-package-draft';
import { formatMoney } from '@/lib/format';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { RowMenu } from '@/components/admin/ui/row-menu';
import { SectionCard } from '@/components/admin/ui/section-card';
import { PackageForm } from './package-form';

interface PackagesManagerProps {
  initial: AdminPlacementPackage[];
}

const PRIMARY_BTN =
  'focus-ring h-10 rounded-none bg-accent px-4 text-[0.8125rem] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60';
const SECONDARY_BTN =
  'focus-ring h-10 rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink';
const BADGE = 'rounded-none px-2 py-[3px] text-[0.65625rem] font-medium';

/** Admin CRUD for the homepage placement tariffs: list, add/edit dialog, publish toggle. */
export function PackagesManager({ initial }: PackagesManagerProps) {
  const t = useTranslations('admin.packages');
  const tc = useTranslations('admin.common');
  const tch = useTranslations('placementChannels');
  const router = useRouter();
  const [draft, setDraft] = useState<PackageDraft | null>(null);
  const [toDelete, setToDelete] = useState<AdminPlacementPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withToken = async (fn: (token: string) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setError(tc('sessionExpired'));
        return;
      }
      await fn(token);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError(tc('errorTitle'));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    withToken(async (token) => {
      if (!draft) return;
      const body = packageDraftToBody(draft);
      if (draft.id) await adminApi.updatePlacementPackage(draft.id, body, { accessToken: token });
      else await adminApi.createPlacementPackage(body, { accessToken: token });
      setDraft(null);
    });

  const togglePublished = (pkg: AdminPlacementPackage) =>
    withToken(async (token) => {
      await adminApi.updatePlacementPackage(
        pkg.id,
        { isPublished: !pkg.isPublished },
        { accessToken: token },
      );
    });

  const remove = () =>
    withToken(async (token) => {
      if (!toDelete) return;
      await adminApi.deletePlacementPackage(toDelete.id, { accessToken: token });
      setToDelete(null);
    });

  const allHidden = initial.length > 0 && initial.every((pkg) => !pkg.isPublished);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[1.375rem] font-medium text-ink">{t('title')}</h1>
          <p className="mt-0.5 text-[0.8125rem] font-medium text-ink-3">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_PACKAGE_DRAFT })}
          className={PRIMARY_BTN}
        >
          + {t('add')}
        </button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {allHidden && <Banner tone="info">{t('allHidden')}</Banner>}

      {initial.length === 0 ? (
        <SectionCard title={t('title')}>
          <EmptyState title={t('empty')} />
        </SectionCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.map((pkg) => (
            <li
              key={pkg.id}
              className="flex items-start gap-4 rounded-none border border-line bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.875rem] font-medium text-ink">{pkg.title}</span>
                  <span className="text-[0.8125rem] font-medium tabular-nums text-ink-2">
                    {formatMoney(pkg.priceUah, 'UAH')}
                  </span>
                  <span
                    className={
                      pkg.isPublished
                        ? `${BADGE} bg-st-published-bg text-st-published-fg`
                        : `${BADGE} bg-st-draft-bg text-st-draft-fg`
                    }
                  >
                    {pkg.isPublished ? t('published') : t('hidden')}
                  </span>
                  {pkg.isFeatured && (
                    <span className={`${BADGE} bg-accent/[0.08] text-accent-hover`}>
                      {t('featuredBadge')}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[0.78125rem] text-ink-3">
                  {pkg.channels.length > 0
                    ? pkg.channels.map((channel) => tch(channel)).join(' · ')
                    : t('noChannels')}
                </p>
                {pkg.description && (
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-2">
                    {pkg.description}
                  </p>
                )}
              </div>
              <RowMenu
                items={[
                  { label: tc('edit'), onSelect: () => setDraft(toPackageDraft(pkg)) },
                  {
                    label: pkg.isPublished ? t('hide') : t('publish'),
                    onSelect: () => void togglePublished(pkg),
                  },
                  { label: t('delete'), danger: true, onSelect: () => setToDelete(pkg) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => (busy ? null : setDraft(null))}
        title={draft?.id ? t('editTitle') : t('addTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={busy}
              className={SECONDARY_BTN}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !draft || !isPackageDraftValid(draft)}
              className={PRIMARY_BTN}
            >
              {busy ? tc('saving') : t('save')}
            </button>
          </>
        }
      >
        {draft && <PackageForm draft={draft} onChange={setDraft} />}
      </Dialog>

      <Dialog
        open={toDelete !== null}
        onClose={() => (busy ? null : setToDelete(null))}
        title={t('deleteConfirmTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={busy}
              className={SECONDARY_BTN}
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="focus-ring h-10 rounded-none platform-destructive px-4 text-[0.8125rem] font-medium transition-colors disabled:opacity-60"
            >
              {busy ? tc('saving') : t('delete')}
            </button>
          </>
        }
      >
        <p className="text-[0.84375rem] font-medium leading-relaxed text-ink-2">
          {toDelete && t('deleteConfirmBody', { title: toDelete.title })}
        </p>
      </Dialog>
    </div>
  );
}
