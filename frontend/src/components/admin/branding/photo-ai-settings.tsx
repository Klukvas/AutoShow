'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SectionCard } from '@/components/admin/ui/section-card';
import { TextField } from '@/components/admin/ui/field';
import { Banner } from '@/components/admin/ui/banner';
import { photoAiSettingsApi, type PhotoAiAccessMode } from '@/lib/admin/photo-ai';
import { PhotoPackPanel } from './photo-pack-panel';

const button =
  'focus-ring min-h-11 border border-line-input px-4 py-2 text-sm font-medium text-ink disabled:opacity-50';
const queryKey = ['photo-ai-settings'];

/** Own action controls; never submits or joins the surrounding branding form. */
export function PhotoAiSettings() {
  const t = useTranslations('admin.photoAiSettings');
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: photoAiSettingsApi.get,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const staff = useQuery({
    queryKey: ['photo-ai-staff'],
    queryFn: photoAiSettingsApi.staff,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [accessMode, setAccessMode] = useState<PhotoAiAccessMode>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [enabledTouched, setEnabledTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const metadata = query.data;
  useEffect(() => {
    if (metadata) {
      setEnabled(metadata.enabled);
      setAccessMode(metadata.accessMode);
      setSelected(metadata.selectedEditorIds);
    }
  }, [metadata]);
  useEffect(() => {
    if (staff.data)
      setSelected((prev) => prev.filter((id) => staff.data?.some((user) => user.id === id)));
  }, [staff.data, metadata]);
  const omittedUnavailable = Boolean(
    metadata &&
    staff.data &&
    metadata.selectedEditorIds.some((id) => !staff.data?.some((user) => user.id === id)),
  );

  async function save(removeKey = false) {
    if (!metadata || busy || (!removeKey && accessMode === 'selected' && !staff.data)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await photoAiSettingsApi.update({
        expectedRevision: metadata.revision,
        ...(removeKey
          ? { removeKey: true }
          : {
              enabled,
              accessMode,
              selectedEditorIds: accessMode === 'selected' ? selected : [],
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            }),
      });
      setApiKey('');
      setEnabled(saved.enabled);
      setEnabledTouched(false);
      setRemoving(false);
      client.setQueryData(queryKey, saved);
      await client.invalidateQueries({ queryKey: ['photo-ai'] });
      setNotice(t(removeKey ? 'removed' : 'saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  function changeApiKey(value: string) {
    setApiKey(value);
    // Saving a first key without ticking the switch left owners with a key that
    // "did nothing". Tick it along with the first key, unless they chose otherwise.
    if (metadata && !metadata.configured && !enabledTouched) setEnabled(value.trim().length > 0);
  }
  const isSavedButDisabled = Boolean(
    metadata && metadata.setupAvailable && metadata.configured && !metadata.enabled,
  );

  return (
    <SectionCard title={t('title')}>
      <p className="mb-4 text-sm leading-relaxed text-ink-2">
        {metadata?.mode === 'managed' ? t('managed.description') : t('description')}
      </p>
      {query.isPending && (
        <p role="status" className="text-sm text-ink-3">
          {t('loading')}
        </p>
      )}
      {(query.error || error) && (
        <Banner tone="error" className="mb-3">
          {error ?? t('error')}
        </Banner>
      )}
      {notice && (
        <p role="status" className="mb-3 text-sm text-accent">
          {notice}
        </p>
      )}
      {metadata && (
        <div className="space-y-4">
          {isSavedButDisabled ? (
            <Banner tone="warning" role="status">
              {t('disabledWarning')}
            </Banner>
          ) : (
            <p className="text-sm text-ink-2" role="status">
              {metadata.mode === 'managed'
                ? t(`managed.status.${metadata.status === 'ready' ? 'ready' : 'disabled'}`)
                : t(`status.${metadata.status}`)}
            </p>
          )}
          {!metadata.setupAvailable && <Banner tone="info">{t('setupUnavailable')}</Banner>}
          {metadata.mode === 'managed' ? (
            <p className="text-sm text-ink-2">{t('managed.keyProvided')}</p>
          ) : (
            <TextField
              label={t('key')}
              hint={t(metadata.configured ? 'replaceHint' : 'keyHint')}
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              autoCapitalize="none"
              maxLength={512}
              value={apiKey}
              disabled={busy || !metadata.setupAvailable}
              onChange={(e) => changeApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!busy && metadata.setupAvailable) void save();
                }
              }}
            />
          )}
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy || (!metadata.setupAvailable && !metadata.enabled)}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setEnabledTouched(true);
              }}
              className="focus-ring mt-1 h-5 w-5 shrink-0"
            />
            {t('enabled')}
          </label>
          <div className="space-y-3 border-t border-line pt-4">
            <label className="block space-y-2 text-sm text-ink-2">
              <span>{t('accessLabel')}</span>
              <select
                className="focus-ring min-h-11 w-full border border-line-input bg-surface px-3 text-ink"
                value={accessMode}
                disabled={busy}
                onChange={(e) => setAccessMode(e.target.value as PhotoAiAccessMode)}
              >
                {(['admins', 'all', 'selected'] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`accessMode.${mode}`)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-relaxed text-ink-3">{t('adminsRetainAccess')}</p>
            {omittedUnavailable && (
              <p role="status" className="text-sm text-ink-2">
                {t('omittedUnavailable')}
              </p>
            )}
            {accessMode === 'selected' && (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm text-ink-2">{t('editorsLabel')}</legend>
                {staff.isPending && <p className="text-sm text-ink-3">{t('staffLoading')}</p>}
                {staff.error && <Banner tone="error">{t('staffError')}</Banner>}
                {staff.data?.length === 0 && <p className="text-sm text-ink-3">{t('noEditors')}</p>}
                {staff.data?.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 break-all text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      className="focus-ring h-5 w-5 shrink-0"
                      checked={selected.includes(user.id)}
                      disabled={busy || (!selected.includes(user.id) && selected.length >= 200)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, user.id]
                            : prev.filter((id) => id !== user.id),
                        )
                      }
                    />
                    {user.email}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
          {metadata.mode !== 'managed' && (
            <p className="text-xs leading-relaxed text-ink-3">{t('billing')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${button} bg-accent text-on-accent border-accent`}
              disabled={
                busy ||
                (!metadata.setupAvailable && enabled) ||
                (accessMode === 'selected' && !staff.data)
              }
              onClick={() => void save()}
            >
              {busy ? t('saving') : t('save')}
            </button>
            {metadata.mode !== 'managed' && metadata.configured && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => setRemoving(true)}
              >
                {t('remove')}
              </button>
            )}
          </div>
          {metadata.mode === 'managed' && <PhotoPackPanel />}
          {removing && (
            <div className="border border-danger-line bg-danger-bg p-3 text-sm text-danger">
              <p>{t('removeConfirm')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  {t('removeNow')}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setRemoving(false)}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
