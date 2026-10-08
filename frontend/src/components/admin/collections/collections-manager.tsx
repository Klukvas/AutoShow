'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { Collection } from '@/lib/api/types';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { SelectField, TextField, TextareaField } from '@/components/admin/ui/field';
import { RowMenu } from '@/components/admin/ui/row-menu';
import { SectionCard } from '@/components/admin/ui/section-card';

interface Draft {
  id: string | null;
  key: string;
  emoji: string;
  titleUk: string;
  descriptionUk: string;
  position: number;
  isPublished: boolean;
  // query fields (flattened for editing)
  bodyType: string;
  fuelType: string;
  transmission: string;
  driveType: string;
  condition: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  mileageMax: string;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  key: '',
  emoji: '',
  titleUk: '',
  descriptionUk: '',
  position: 0,
  isPublished: true,
  bodyType: '',
  fuelType: '',
  transmission: '',
  driveType: '',
  condition: '',
  priceMin: '',
  priceMax: '',
  yearMin: '',
  mileageMax: '',
};

function draftFrom(c: Collection): Draft {
  const q = c.query ?? {};
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    id: c.id,
    key: c.key,
    emoji: c.emoji ?? '',
    titleUk: c.titleUk,
    descriptionUk: c.descriptionUk ?? '',
    position: c.position,
    isPublished: c.isPublished,
    bodyType: s(q.bodyType),
    fuelType: s(q.fuelType),
    transmission: s(q.transmission),
    driveType: s(q.driveType),
    condition: s(q.condition),
    priceMin: s(q.priceMin),
    priceMax: s(q.priceMax),
    yearMin: s(q.yearMin),
    mileageMax: s(q.mileageMax),
  };
}

function bodyFrom(draft: Draft) {
  const query: Record<string, unknown> = {};
  const setStr = (key: string, v: string) => {
    const s = v.trim();
    if (s) query[key] = s;
  };
  const setNum = (key: string, v: string) => {
    const s = v.trim();
    if (s !== '') query[key] = Number(s);
  };
  setStr('bodyType', draft.bodyType);
  setStr('fuelType', draft.fuelType);
  setStr('transmission', draft.transmission);
  setStr('driveType', draft.driveType);
  if (draft.condition) query.condition = draft.condition;
  setNum('priceMin', draft.priceMin);
  setNum('priceMax', draft.priceMax);
  setNum('yearMin', draft.yearMin);
  setNum('mileageMax', draft.mileageMax);
  return {
    key: draft.key.trim(),
    emoji: draft.emoji.trim() || undefined,
    titleUk: draft.titleUk.trim(),
    descriptionUk: draft.descriptionUk.trim() || undefined,
    position: draft.position,
    isPublished: draft.isPublished,
    query,
  };
}

/** Admin CRUD for curated SEO collections (single source for storefront + sitemap). */
export function CollectionsManager({ initial }: { initial: Collection[] }) {
  const t = useTranslations('admin.collections');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Collection | null>(null);
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
      if (draft.id) await adminApi.updateCollection(draft.id, body, { accessToken: token });
      else await adminApi.createCollection(body, { accessToken: token });
      setDraft(null);
    });

  const togglePublished = (c: Collection) =>
    withToken(async (token) => {
      await adminApi.updateCollection(
        c.id,
        { isPublished: !c.isPublished },
        { accessToken: token },
      );
    });

  const remove = () =>
    withToken(async (token) => {
      if (!toDelete) return;
      await adminApi.deleteCollection(toDelete.id, { accessToken: token });
      setToDelete(null);
    });

  const keyValid = draft && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.key.trim());
  const draftValid = keyValid && draft && draft.titleUk.trim().length >= 2;

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
          {initial.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-4 rounded-[12px] border border-line bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="text-[18px]">
                    {c.emoji}
                  </span>
                  <span className="text-[14px] font-bold text-ink">{c.titleUk}</span>
                  <code className="rounded-[5px] bg-surface-2 px-1.5 py-[2px] text-[11px] text-ink-3">
                    /{c.key}
                  </code>
                  <span
                    className={
                      c.isPublished
                        ? 'rounded-[5px] bg-st-published-bg px-2 py-[3px] text-[10.5px] font-bold text-st-published-fg'
                        : 'rounded-[5px] bg-st-draft-bg px-2 py-[3px] text-[10.5px] font-bold text-st-draft-fg'
                    }
                  >
                    {c.isPublished ? t('published') : t('hidden')}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-[12.5px] text-ink-3">
                  {Object.entries(c.query ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ') || t('noFilters')}
                </p>
              </div>
              <RowMenu
                items={[
                  { label: tc('edit'), onSelect: () => setDraft(draftFrom(c)) },
                  {
                    label: c.isPublished ? t('hidden') : t('published'),
                    onSelect: () => void togglePublished(c),
                  },
                  { label: t('delete'), danger: true, onSelect: () => setToDelete(c) },
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
            <div className="flex gap-3">
              <TextField
                label={t('key')}
                hint={t('keyHint')}
                required
                className="flex-1"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              />
              <TextField
                label={t('emoji')}
                maxLength={16}
                className="w-24"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              />
            </div>
            <TextField
              label={t('titleField')}
              required
              maxLength={160}
              value={draft.titleUk}
              onChange={(e) => setDraft({ ...draft, titleUk: e.target.value })}
            />
            <TextareaField
              label={t('description')}
              maxLength={500}
              rows={2}
              value={draft.descriptionUk}
              onChange={(e) => setDraft({ ...draft, descriptionUk: e.target.value })}
            />

            <p className="mt-1 text-[12px] font-semibold text-ink-2">{t('filtersTitle')}</p>
            <p className="-mt-2 text-[11.5px] text-ink-3">{t('filtersHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('f.bodyType')}
                value={draft.bodyType}
                onChange={(e) => setDraft({ ...draft, bodyType: e.target.value })}
              />
              <TextField
                label={t('f.fuelType')}
                value={draft.fuelType}
                onChange={(e) => setDraft({ ...draft, fuelType: e.target.value })}
              />
              <TextField
                label={t('f.transmission')}
                value={draft.transmission}
                onChange={(e) => setDraft({ ...draft, transmission: e.target.value })}
              />
              <TextField
                label={t('f.driveType')}
                value={draft.driveType}
                onChange={(e) => setDraft({ ...draft, driveType: e.target.value })}
              />
              <SelectField
                label={t('f.condition')}
                value={draft.condition}
                onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
              >
                <option value="">—</option>
                <option value="new">new</option>
                <option value="used">used</option>
                <option value="damaged">damaged</option>
              </SelectField>
              <TextField
                label={t('f.priceMin')}
                type="number"
                min={0}
                value={draft.priceMin}
                onChange={(e) => setDraft({ ...draft, priceMin: e.target.value })}
              />
              <TextField
                label={t('f.priceMax')}
                type="number"
                min={0}
                value={draft.priceMax}
                onChange={(e) => setDraft({ ...draft, priceMax: e.target.value })}
              />
              <TextField
                label={t('f.yearMin')}
                type="number"
                min={1900}
                value={draft.yearMin}
                onChange={(e) => setDraft({ ...draft, yearMin: e.target.value })}
              />
              <TextField
                label={t('f.mileageMax')}
                type="number"
                min={0}
                value={draft.mileageMax}
                onChange={(e) => setDraft({ ...draft, mileageMax: e.target.value })}
              />
            </div>

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
          {toDelete && t('deleteConfirmBody', { title: toDelete.titleUk })}
        </p>
      </Dialog>
    </div>
  );
}
