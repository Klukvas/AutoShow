'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { CatalogTag } from '@/lib/api/types';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { TextField } from '@/components/admin/ui/field';
import { RowMenu } from '@/components/admin/ui/row-menu';
import { SectionCard } from '@/components/admin/ui/section-card';

interface Draft {
  id: string | null;
  nameUk: string;
  slug: string;
  position: number;
  isPublished: boolean;
}

const EMPTY_DRAFT: Draft = { id: null, nameUk: '', slug: '', position: 0, isPublished: true };

function draftFrom(tag: CatalogTag): Draft {
  return {
    id: tag.id,
    nameUk: tag.nameUk,
    slug: tag.slug,
    position: tag.position,
    isPublished: tag.isPublished,
  };
}

function bodyFrom(draft: Draft) {
  return {
    nameUk: draft.nameUk.trim(),
    slug: draft.slug.trim(),
    position: draft.position,
    isPublished: draft.isPublished,
  };
}

/** Admin CRUD for the curated tag dictionary (storefront badges + filter facet). */
export function TagsManager({ initial }: { initial: CatalogTag[] }) {
  const t = useTranslations('admin.tags');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<CatalogTag | null>(null);
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
      const body = bodyFrom(draft);
      if (draft.id) await adminApi.updateTag(draft.id, body, { accessToken: token });
      else await adminApi.createTag(body, { accessToken: token });
      setDraft(null);
    });

  const togglePublished = (tag: CatalogTag) =>
    withToken(async (token) => {
      await adminApi.updateTag(tag.id, { isPublished: !tag.isPublished }, { accessToken: token });
    });

  const remove = () =>
    withToken(async (token) => {
      if (!toDelete) return;
      await adminApi.deleteTag(toDelete.id, { accessToken: token });
      setToDelete(null);
    });

  const slugValid = draft && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug.trim());
  const draftValid = slugValid && draft && draft.nameUk.trim().length >= 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[22px] font-extrabold text-ink">{t('title')}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-ink-3">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className="focus-ring h-10 rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
        >
          + {t('add')}
        </button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {initial.length === 0 ? (
        <SectionCard title={t('title')}>
          <EmptyState title={t('empty')} />
        </SectionCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.map((tag) => (
            <li
              key={tag.id}
              className="flex items-start gap-4 rounded-[12px] border border-line bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold text-ink">{tag.nameUk}</span>
                  <code className="rounded-[5px] bg-surface-2 px-1.5 py-[2px] text-[11px] text-ink-3">
                    {tag.slug}
                  </code>
                  <span
                    className={
                      tag.isPublished
                        ? 'rounded-[5px] bg-ok-bg px-2 py-[3px] text-[10.5px] font-bold text-ok'
                        : 'rounded-[5px] bg-st-draft-bg px-2 py-[3px] text-[10.5px] font-bold text-ink-3'
                    }
                  >
                    {tag.isPublished ? t('published') : t('hidden')}
                  </span>
                </div>
              </div>
              <RowMenu
                items={[
                  { label: tc('edit'), onSelect: () => setDraft(draftFrom(tag)) },
                  {
                    label: tag.isPublished ? t('hidden') : t('published'),
                    onSelect: () => void togglePublished(tag),
                  },
                  { label: t('delete'), danger: true, onSelect: () => setToDelete(tag) },
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
              className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !draftValid}
              className="focus-ring h-10 rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? tc('saving') : tc('save')}
            </button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3.5">
            <TextField
              label={t('nameField')}
              required
              maxLength={64}
              value={draft.nameUk}
              onChange={(e) => setDraft({ ...draft, nameUk: e.target.value })}
            />
            <TextField
              label={t('slug')}
              hint={t('slugHint')}
              required
              maxLength={64}
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
            <div className="flex items-center gap-4">
              <TextField
                label={t('positionLabel')}
                type="number"
                min={0}
                className="w-32"
                value={String(draft.position)}
                onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
              />
              <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                {t('publishedField')}
              </label>
            </div>
          </div>
        )}
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
              className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="focus-ring h-10 rounded-[9px] bg-danger px-4 text-[13px] font-bold text-white transition-colors disabled:opacity-60"
            >
              {busy ? tc('saving') : t('delete')}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
          {toDelete && t('deleteConfirmBody', { title: toDelete.nameUk })}
        </p>
      </Dialog>
    </div>
  );
}
