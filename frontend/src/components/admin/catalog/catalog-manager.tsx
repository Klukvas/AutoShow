'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminRole } from '@/lib/api/admin';
import type { AdminCatalogMake, CatalogMake, CatalogModel } from '@/lib/api/types';
import { SectionCard } from '@/components/admin/ui/section-card';
import { TextField } from '@/components/admin/ui/field';
import { Dialog } from '@/components/admin/ui/dialog';
import {
  MakeEditor,
  MakeLogo,
  ModelEditor,
  catalogButton,
  catalogPrimary,
  catalogToken,
} from './catalog-editor';

type Editing =
  | { kind: 'make'; make?: CatalogMake }
  | { kind: 'model'; model?: CatalogModel }
  | null;
export function CatalogManager({ role }: { role: AdminRole }) {
  const t = useTranslations('admin.catalog');
  const [makes, setMakes] = useState<AdminCatalogMake[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<{
    kind: 'make' | 'model';
    id: string;
    name: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const selected = makes.find((make) => make.id === selectedId);
  const visible = useMemo(
    () =>
      makes.filter((make) =>
        `${make.nameUk} ${make.nameEn ?? ''}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [makes, query],
  );
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const opts = await catalogToken();
      const [nextMakes, nextModels] = await Promise.all([
        adminApi.listCatalogMakes(opts),
        adminApi.listCatalogModels(undefined, opts),
      ]);
      setMakes(nextMakes);
      setModels(nextModels);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* first authenticated load */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savedMake = (make: CatalogMake) => {
    setMakes((current) => {
      const previous = current.find((item) => item.id === make.id);
      return [
        ...current.filter((item) => item.id !== make.id),
        { ...make, modelCount: previous?.modelCount ?? 0 },
      ].sort((a, b) => a.nameUk.localeCompare(b.nameUk));
    });
    setSelectedId(make.id);
    setEditing(null);
  };
  const savedModel = (model: CatalogModel) => {
    const isNew = !models.some((item) => item.id === model.id);
    setModels((current) =>
      [...current.filter((item) => item.id !== model.id), model].sort((a, b) =>
        a.nameUk.localeCompare(b.nameUk),
      ),
    );
    if (isNew)
      setMakes((current) =>
        current.map((make) =>
          make.id === model.makeId ? { ...make, modelCount: make.modelCount + 1 } : make,
        ),
      );
    setEditing(null);
  };
  const remove = async () => {
    if (!deleting || pendingDelete) return;
    setPendingDelete(true);
    setDeleteError('');
    try {
      const opts = await catalogToken();
      if (deleting.kind === 'make') {
        await adminApi.deleteCatalogMake(deleting.id, opts);
        setMakes((current) => current.filter((make) => make.id !== deleting.id));
        setSelectedId('');
      } else {
        await adminApi.deleteCatalogModel(deleting.id, opts);
        setModels((current) => current.filter((model) => model.id !== deleting.id));
        setMakes((current) =>
          current.map((make) =>
            make.id === selectedId ? { ...make, modelCount: make.modelCount - 1 } : make,
          ),
        );
      }
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setPendingDelete(false);
    }
  };
  return (
    <div className="mx-auto max-w-[1200px]">
      <p className="mb-2 text-xs uppercase tracking-widest text-ink-3">{t('dictionary')}</p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium tracking-tight">{t('title')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-3">{t('description')}</p>
        </div>
        <button
          type="button"
          className={catalogPrimary}
          onClick={() => setEditing({ kind: 'make' })}
        >
          + {t('addMake')}
        </button>
      </div>
      {error && (
        <div role="alert" className="mb-4 border border-danger p-4 text-sm text-danger">
          {error}
          <button type="button" className={`${catalogButton} ml-3`} onClick={() => void load()}>
            {t('retry')}
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="mb-4 text-sm text-ink-3">
          {t('loading')}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <SectionCard title={t('makes')}>
          <TextField
            label={t('search')}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-4 divide-y divide-line">
            {visible.map((make) => (
              <div
                key={make.id}
                className={`flex flex-wrap items-center gap-3 py-3 ${make.id === selectedId ? 'border-l-2 border-accent pl-3' : ''}`}
              >
                <MakeLogo name={make.nameUk} url={make.logoUrl} />
                <button
                  type="button"
                  aria-pressed={make.id === selectedId}
                  onClick={() => setSelectedId(make.id)}
                  className="focus-ring min-h-11 min-w-0 flex-1 text-left"
                >
                  <span className="block break-words font-medium">{make.nameUk}</span>
                  <span className="text-xs text-ink-3">
                    {t('modelCount', { count: make.modelCount })}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${t('editMake')}: ${make.nameUk}`}
                  className={catalogButton}
                  onClick={() => setEditing({ kind: 'make', make })}
                >
                  {t('edit')}
                </button>
              </div>
            ))}
            {!loading && visible.length === 0 && (
              <p className="py-6 text-sm text-ink-3">{query ? t('noMatches') : t('noMakes')}</p>
            )}
          </div>
        </SectionCard>
        <SectionCard title={selected ? selected.nameUk : t('models')}>
          {selected ? (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <MakeLogo name={selected.nameUk} url={selected.logoUrl} />
                <span className="mr-auto text-sm text-ink-3">
                  {t('modelCount', { count: selected.modelCount })}
                </span>
                <button
                  type="button"
                  className={catalogPrimary}
                  onClick={() => setEditing({ kind: 'model' })}
                >
                  + {t('addModel')}
                </button>
              </div>
              <div className="divide-y divide-line">
                {models
                  .filter((model) => model.makeId === selected.id)
                  .map((model) => (
                    <div key={model.id} className="flex flex-wrap items-center gap-2 py-3">
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">
                        {model.nameUk}
                      </span>
                      <button
                        type="button"
                        className={catalogButton}
                        aria-label={`${t('editModel')}: ${model.nameUk}`}
                        onClick={() => setEditing({ kind: 'model', model })}
                      >
                        {t('edit')}
                      </button>
                      {role === 'admin' && (
                        <button
                          type="button"
                          className={`${catalogButton} text-danger`}
                          aria-label={`${t('deleteModel')}: ${model.nameUk}`}
                          onClick={() => {
                            setDeleteError('');
                            setDeleting({ kind: 'model', id: model.id, name: model.nameUk });
                          }}
                        >
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              {!models.some((model) => model.makeId === selected.id) && (
                <p className="py-4 text-sm text-ink-3">{t('noModels')}</p>
              )}
              {role === 'admin' && (
                <div className="mt-6 border-t border-line pt-4">
                  <button
                    type="button"
                    className={`${catalogButton} text-danger`}
                    onClick={() => {
                      setDeleteError('');
                      setDeleting({ kind: 'make', id: selected.id, name: selected.nameUk });
                    }}
                  >
                    {t('deleteMake')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="py-12 text-center text-sm leading-relaxed text-ink-3">
              {t('selectMake')}
            </p>
          )}
        </SectionCard>
      </div>
      {editing?.kind === 'make' && (
        <MakeEditor
          initial={editing.make}
          onClose={() => {
            setEditing(null);
            void load();
          }}
          onSaved={savedMake}
        />
      )}
      {editing?.kind === 'model' && selected && (
        <ModelEditor
          make={selected}
          initial={editing.model}
          onClose={() => setEditing(null)}
          onSaved={savedModel}
        />
      )}
      {deleting && (
        <Dialog
          open
          title={t('deleteTitle', { name: deleting.name })}
          onClose={() => {
            if (!pendingDelete) setDeleting(null);
          }}
          footer={
            <>
              <button
                type="button"
                className={catalogButton}
                disabled={pendingDelete}
                onClick={() => setDeleting(null)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className={`${catalogButton} text-danger`}
                disabled={pendingDelete}
                onClick={() => void remove()}
              >
                {t('confirmDelete')}
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-3">{t('deleteHint')}</p>
          {deleteError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {deleteError}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
