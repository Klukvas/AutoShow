'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SectionCard } from '@/components/admin/ui/section-card';
import { TextareaField } from '@/components/admin/ui/field';
import { Banner } from '@/components/admin/ui/banner';
import { photoAiSettingsApi, type PhotoAiAccessMode } from '@/lib/admin/photo-ai';
import {
  BRAND_EXAMPLE_MAX,
  BRAND_TONE_MAX,
  bannedWordsProblem,
  listingAiSettingsApi,
  parseBannedWords,
  type ListingAiSettings as Settings,
} from '@/lib/admin/listing-ai';

const button =
  'focus-ring min-h-11 border border-line-input px-4 py-2 text-sm font-medium text-ink disabled:opacity-50';
const queryKey = ['listing-ai-settings'];

/** Owner settings of AI descriptions: switch, editor access and brand voice. */
export function ListingAiSettings() {
  const t = useTranslations('admin.listingAiSettings');
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: listingAiSettingsApi.get,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const staff = useQuery({
    queryKey: ['photo-ai-staff'],
    queryFn: photoAiSettingsApi.staff,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const settings = query.data;
  const [enabled, setEnabled] = useState(false);
  const [accessMode, setAccessMode] = useState<PhotoAiAccessMode>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [bannedText, setBannedText] = useState('');
  const [example, setExample] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled);
    setAccessMode(settings.accessMode);
    setSelected(settings.selectedEditorIds);
    setTone(settings.brandVoice.tone);
    setBannedText(settings.brandVoice.bannedWords.join(', '));
    setExample(settings.brandVoice.example);
  }, [settings]);

  // A deactivated editor cannot be ticked or kept: drop them and say so.
  useEffect(() => {
    if (staff.data)
      setSelected((prev) => prev.filter((id) => staff.data?.some((user) => user.id === id)));
  }, [staff.data, settings]);
  const omittedUnavailable = Boolean(
    settings &&
    staff.data &&
    settings.selectedEditorIds.some((id) => !staff.data?.some((user) => user.id === id)),
  );

  const bannedWords = useMemo(() => parseBannedWords(bannedText), [bannedText]);
  const bannedProblem = bannedWordsProblem(bannedWords);
  const needsStaff = accessMode === 'selected' && !staff.data;

  async function save(current: Settings) {
    if (busy || bannedProblem || needsStaff) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await listingAiSettingsApi.update({
        expectedRevision: current.revision,
        enabled,
        accessMode,
        selectedEditorIds: accessMode === 'selected' ? selected : [],
        brandTone: tone.trim(),
        brandBannedWords: bannedWords,
        brandExample: example.trim(),
      });
      client.setQueryData(queryKey, saved);
      setNotice(t('saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={t('title')}>
      <p className="mb-4 text-sm leading-relaxed text-ink-2">{t('description')}</p>
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
      {settings && (
        <div className="space-y-4">
          {!settings.keyUsable ? (
            <Banner tone="info" role="status">
              {settings.keyMode === 'managed' ? t('noKeyManaged') : t('noKey')}
            </Banner>
          ) : !settings.enabled ? (
            <Banner tone="warning" role="status">
              {t('disabledWarning')}
            </Banner>
          ) : (
            <p className="text-sm text-ink-2" role="status">
              {t('ready')}
            </p>
          )}
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy || (!settings.keyUsable && !settings.enabled)}
              onChange={(e) => setEnabled(e.target.checked)}
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
                      disabled={busy}
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

          <div className="space-y-4 border-t border-line pt-4">
            <div>
              <h3 className="font-heading text-sm font-medium text-ink">{t('voiceTitle')}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">{t('voiceHint')}</p>
            </div>
            <TextareaField
              label={t('tone')}
              hint={t('toneHint', { count: tone.length, max: BRAND_TONE_MAX })}
              maxLength={BRAND_TONE_MAX}
              rows={3}
              value={tone}
              disabled={busy}
              onChange={(e) => setTone(e.target.value)}
            />
            <TextareaField
              label={t('bannedWords')}
              hint={t('bannedWordsHint', { count: bannedWords.length })}
              error={bannedProblem}
              rows={2}
              value={bannedText}
              disabled={busy}
              onChange={(e) => setBannedText(e.target.value)}
            />
            <TextareaField
              label={t('example')}
              hint={t('exampleHint', { count: example.length, max: BRAND_EXAMPLE_MAX })}
              maxLength={BRAND_EXAMPLE_MAX}
              rows={5}
              value={example}
              disabled={busy}
              onChange={(e) => setExample(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={`${button} bg-accent text-on-accent border-accent`}
            disabled={
              busy || Boolean(bannedProblem) || needsStaff || (!settings.keyUsable && enabled)
            }
            onClick={() => void save(settings)}
          >
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      )}
    </SectionCard>
  );
}
