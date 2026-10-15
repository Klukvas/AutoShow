'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import type { CatalogMake, CatalogModel } from '@/lib/api/types';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { slugify } from '@/lib/admin/slugify';
import { Dialog } from '@/components/admin/ui/dialog';
import { TextField } from '@/components/admin/ui/field';

export const catalogButton =
  'focus-ring inline-flex min-h-11 items-center justify-center gap-2 border border-line-input px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50';
export const catalogPrimary = `${catalogButton} border-accent bg-accent text-on-accent hover:bg-accent-hover`;

export function MakeLogo({ name, url }: { name: string; url?: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- catalog object URL or normalized public image
    <img src={url} alt="" className="h-12 w-12 shrink-0 object-contain" />
  ) : (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center bg-surface-2 font-heading text-xl text-ink-3"
    >
      {name[0]?.toUpperCase() ?? 'М'}
    </span>
  );
}

export async function catalogToken() {
  const accessToken = await fetchAccessToken();
  if (!accessToken) throw new Error('Сесію завершено. Увійдіть знову');
  return { accessToken };
}

type MakeEditorProps = {
  initial?: CatalogMake;
  initialName?: string;
  onClose: () => void;
  onSaved: (make: CatalogMake) => void;
};

export function MakeEditor({ initial, initialName = '', onClose, onSaved }: MakeEditorProps) {
  const t = useTranslations('admin.catalog');
  const [name, setName] = useState(initial?.nameUk ?? initialName);
  // A successful create is retained if its subsequent upload fails: retry never creates a duplicate.
  const [saved, setSaved] = useState<CatalogMake | undefined>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const logoUrl = removed ? null : (preview ?? saved?.logoUrl);

  const save = async () => {
    if (pending || !name.trim()) return;
    setPending(true);
    setError('');
    try {
      const opts = await catalogToken();
      const body = {
        nameUk: name.trim(),
        slug: saved?.slug ?? slugify(name.trim()).slice(0, 64).replace(/-$/, ''),
      };
      const make = saved
        ? await adminApi.updateCatalogMake(saved.id, body, opts)
        : await adminApi.createCatalogMake(body, opts);
      setSaved(make);
      let next: CatalogMake = make;
      if (file) next = { ...make, ...(await adminApi.uploadCatalogLogo(make.id, file, opts)) };
      else if (removed) next = { ...make, ...(await adminApi.removeCatalogLogo(make.id, opts)) };
      onSaved(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setPending(false);
    }
  };

  const close = () => {
    if (pending) return;
    // The name was explicitly saved before a failed upload. Keep that persisted
    // make available to the caller even when the user cancels the file retry.
    if (saved && !initial) onSaved(saved);
    else onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title={initial ? t('editMake') : t('addMake')}
      footer={
        <>
          <button type="button" className={catalogButton} disabled={pending} onClick={close}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={catalogPrimary}
            disabled={pending || !name.trim()}
            onClick={() => void save()}
          >
            {pending ? t('saving') : t('save')}
          </button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            event.target instanceof HTMLInputElement &&
            event.target.type === 'text'
          ) {
            event.preventDefault();
            void save();
          }
        }}
      >
        <TextField
          label={t('makeName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={128}
          required
          disabled={pending}
        />
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-xs font-medium text-ink-2">{t('logo')}</p>
          <div className="flex items-center gap-4">
            <MakeLogo name={name} url={logoUrl} />
            <span className="text-xs text-ink-3">{logoUrl ? t('logoPreview') : t('noLogo')}</span>
          </div>
          <label
            className={`${catalogButton} mt-3 cursor-pointer focus-within:shadow-[0_0_0_2px_rgb(var(--bg)),0_0_0_4px_rgb(var(--focus))]`}
          >
            {logoUrl ? t('replaceLogo') : t('uploadLogo')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={logoUrl ? t('replaceLogo') : t('uploadLogo')}
              className="sr-only"
              disabled={pending}
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                event.target.value = '';
                if (!chosen) return;
                if (
                  chosen.size > 2 * 1024 * 1024 ||
                  !['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type)
                ) {
                  setError(t('fileInvalid'));
                  return;
                }
                setFile(chosen);
                setRemoved(false);
                setError('');
              }}
            />
          </label>
          {logoUrl && (
            <button
              type="button"
              className={`${catalogButton} ml-2 mt-3`}
              disabled={pending}
              onClick={() => {
                setFile(null);
                setRemoved(true);
              }}
            >
              {t('removeLogo')}
            </button>
          )}
          <p className="mt-2 text-xs leading-relaxed text-ink-3">{t('logoHint')}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error} {saved && !initial ? t('makeSavedRetry') : ''}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function ModelEditor({
  make,
  initial,
  initialName = '',
  onClose,
  onSaved,
}: {
  make: CatalogMake;
  initial?: CatalogModel;
  initialName?: string;
  onClose: () => void;
  onSaved: (model: CatalogModel) => void;
}) {
  const t = useTranslations('admin.catalog');
  const [name, setName] = useState(initial?.nameUk ?? initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (pending || !name.trim()) return;
    setPending(true);
    setError('');
    try {
      const opts = await catalogToken();
      const body = {
        nameUk: name.trim(),
        slug: initial?.slug ?? slugify(name.trim()).slice(0, 64).replace(/-$/, ''),
        makeId: make.id,
      };
      const saved = initial
        ? await adminApi.updateCatalogModel(initial.id, body, opts)
        : await adminApi.createCatalogModel(body, opts);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      title={initial ? t('editModel') : t('addModel')}
      footer={
        <>
          <button type="button" disabled={pending} className={catalogButton} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={pending || !name.trim()}
            className={catalogPrimary}
            onClick={() => void save()}
          >
            {pending ? t('saving') : t('save')}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-3">{make.nameUk}</p>
      <div
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          }
        }}
      >
        <TextField
          label={t('modelName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={128}
          required
          disabled={pending}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
