'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminReview } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { SelectField, TextField, TextareaField } from '@/components/admin/ui/field';
import { RowMenu } from '@/components/admin/ui/row-menu';
import { SectionCard } from '@/components/admin/ui/section-card';

interface ReviewsManagerProps {
  initial: AdminReview[];
}

interface Draft {
  id: string | null;
  authorName: string;
  city: string;
  text: string;
  rating: number;
  position: number;
}

const EMPTY_DRAFT: Draft = { id: null, authorName: '', city: '', text: '', rating: 5, position: 0 };

/** Admin CRUD for homepage testimonials: list, add/edit dialog, publish toggle. */
export function ReviewsManager({ initial }: ReviewsManagerProps) {
  const t = useTranslations('admin.reviews');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<AdminReview | null>(null);
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
      const body = {
        authorName: draft.authorName.trim(),
        city: draft.city.trim() || undefined,
        text: draft.text.trim(),
        rating: draft.rating,
        position: draft.position,
      };
      if (draft.id) await adminApi.updateReview(draft.id, body, { accessToken: token });
      else await adminApi.createReview(body, { accessToken: token });
      setDraft(null);
    });

  const togglePublished = (review: AdminReview) =>
    withToken(async (token) => {
      await adminApi.updateReview(
        review.id,
        { isPublished: !review.isPublished },
        { accessToken: token },
      );
    });

  const remove = () =>
    withToken(async (token) => {
      if (!toDelete) return;
      await adminApi.deleteReview(toDelete.id, { accessToken: token });
      setToDelete(null);
    });

  const draftValid = draft && draft.authorName.trim().length >= 2 && draft.text.trim().length >= 10;

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
          {initial.map((review) => (
            <li
              key={review.id}
              className="flex items-start gap-4 rounded-[12px] border border-line bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold text-ink">{review.authorName}</span>
                  {review.city && <span className="text-[12.5px] text-ink-3">{review.city}</span>}
                  <span aria-label={`${review.rating}/5`} className="text-[12px] text-warn-strong">
                    {'★'.repeat(review.rating)}
                  </span>
                  <span
                    className={
                      review.isPublished
                        ? 'rounded-[5px] bg-ok-bg px-2 py-[3px] text-[10.5px] font-bold text-ok'
                        : 'rounded-[5px] bg-st-draft-bg px-2 py-[3px] text-[10.5px] font-bold text-ink-3'
                    }
                  >
                    {review.isPublished ? t('published') : t('hidden')}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                  {review.text}
                </p>
              </div>
              <RowMenu
                items={[
                  {
                    label: tc('edit'),
                    onSelect: () =>
                      setDraft({
                        id: review.id,
                        authorName: review.authorName,
                        city: review.city ?? '',
                        text: review.text,
                        rating: review.rating,
                        position: review.position,
                      }),
                  },
                  {
                    label: review.isPublished ? t('hidden') : t('published'),
                    onSelect: () => void togglePublished(review),
                  },
                  { label: t('delete'), danger: true, onSelect: () => setToDelete(review) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit dialog */}
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
              {busy ? tc('saving') : t('save')}
            </button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3.5">
            <TextField
              label={t('author')}
              required
              minLength={2}
              maxLength={128}
              value={draft.authorName}
              onChange={(e) => setDraft({ ...draft, authorName: e.target.value })}
            />
            <TextField
              label={t('city')}
              maxLength={128}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
            <TextareaField
              label={t('text')}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
            <div className="flex gap-3">
              <SelectField
                label={t('rating')}
                className="flex-1"
                value={String(draft.rating)}
                onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('positionLabel')}
                type="number"
                min={0}
                className="flex-1"
                value={String(draft.position)}
                onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete confirmation */}
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
          {toDelete && t('deleteConfirmBody', { author: toDelete.authorName })}
        </p>
      </Dialog>
    </div>
  );
}
