'use client';
/* eslint-disable @next/next/no-img-element -- exact original/candidate inspection, uncropped */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/components/admin/ui/dialog';
import { Banner } from '@/components/admin/ui/banner';
import { cn } from '@/lib/cn';
import {
  photoAiApi,
  scenePrompt,
  generationAttempt,
  type PhotoAiAttempt,
  type PhotoAiCategory,
  type PhotoAiPreset,
} from '@/lib/admin/photo-ai';

const button =
  'focus-ring min-h-11 border border-line-input bg-surface px-3 py-2 text-sm font-medium text-ink disabled:opacity-50';
const input = 'focus-ring w-full border border-line-input bg-surface px-3 py-2 text-sm text-ink';

export function PhotoAiWorkspace({
  mediaId,
  onClose,
  onApplied,
}: {
  mediaId: string;
  onClose: () => void;
  onApplied: () => Promise<void>;
}) {
  const t = useTranslations('admin.photoAi');
  const client = useQueryClient();
  const attempt = useRef<PhotoAiAttempt | null>(null);
  const [category, setCategory] = useState<PhotoAiCategory>('enhance');
  const [prompt, setPrompt] = useState('');
  const [presetName, setPresetName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [constructor, setConstructor] = useState(false);
  const [background, setBackground] = useState(t('defaultBackground'));
  const [time, setTime] = useState(t('defaultTime'));
  const [lighting, setLighting] = useState(t('defaultLighting'));
  const [extra, setExtra] = useState('');
  const queryKey = ['photo-ai', mediaId];
  const query = useQuery({
    queryKey,
    queryFn: () => photoAiApi.workspace(mediaId),
    refetchInterval: (q) =>
      q.state.data?.permitted &&
      q.state.data.history.some((g) => ['queued', 'processing'].includes(g.status))
        ? 3000
        : false,
  });
  const data = query.data?.permitted ? query.data : undefined;
  const selected =
    data?.history.find((g) => g.id === selectedId) ??
    data?.history.find((g) => g.id === data.activeGenerationId) ??
    data?.history[0];
  const inFlight = data?.history.some((g) => ['queued', 'processing'].includes(g.status));

  useEffect(() => {
    setReviewed(false);
  }, [selected?.id]);

  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ['photo-ai', mediaId] });
  }, [client, mediaId]);

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionFailed'));
    } finally {
      setBusy(false);
    }
  }
  function choosePreset(preset: PhotoAiPreset) {
    setCategory(preset.category);
    setPrompt(preset.prompt);
    setConstructor(false);
    setNotice(null);
  }
  function chooseCategory(value: PhotoAiCategory) {
    setCategory(value);
    setConstructor(false);
    // Manual instructions survive category switches; selection explicitly replaces them.
    if (prompt) setNotice(t('retainedPrompt'));
  }
  const canGenerate = Boolean(data?.enabled && !inFlight && prompt.trim().length >= 5 && !busy);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('title')}
      className="!max-w-[1120px]"
      footer={
        data ? (
          <>
            {data?.activeGenerationId && (
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await photoAiApi.restore(mediaId, data.revision);
                    await refresh();
                    await onApplied();
                    setNotice(t('restored'));
                  })
                }
              >
                {t('restore')}
              </button>
            )}
            <button
              className={cn(button, 'bg-accent text-on-accent border-accent')}
              disabled={
                busy ||
                !reviewed ||
                selected?.status !== 'ready' ||
                selected.id === data?.activeGenerationId
              }
              onClick={() =>
                void action(async () => {
                  if (!selected || !data) return;
                  await photoAiApi.apply(mediaId, selected.id, data.revision);
                  await refresh();
                  await onApplied();
                  setNotice(t('appliedNotice'));
                })
              }
            >
              {selected?.id === data?.activeGenerationId ? t('applied') : t('apply')}
            </button>
          </>
        ) : undefined
      }
    >
      {query.data?.permitted === false && (
        <Banner tone="info">
          <p>{query.data.permissionReason}</p>
          <p className="mt-2">{t('accessDeniedHint')}</p>
        </Banner>
      )}
      {data && <p className="mb-4 text-sm text-ink-2">{t('warning')}</p>}
      {(error || query.error) && (
        <Banner tone="error" className="mb-3">
          {error ?? (query.error instanceof Error ? query.error.message : t('historyFailed'))}
        </Banner>
      )}
      {notice && (
        <p role="status" className="mb-3 text-sm text-accent">
          {notice}
        </p>
      )}
      {query.isPending && <p role="status">{t('loading')}</p>}
      {data && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
          <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <CompareImage label={t('original')} src={data.originalUrl} />
              <CompareImage
                label={t('candidate')}
                src={selected?.status === 'ready' ? selected.previewUrl : null}
                empty={selected ? t(`status.${selected.status}`) : t('emptyCandidate')}
              />
            </div>
            <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-2">
              {selected ? t(`status.${selected.status}`) : t('noCandidate')}
              {inFlight && t('keepWorking')}
            </p>
            {selected?.failureReason && (
              <Banner tone="error" className="mt-3">
                {selected.failureReason}
              </Banner>
            )}
            {selected?.status === 'interrupted' && (
              <p className="mt-2 text-sm text-ink-2">{t('interruptedHint')}</p>
            )}
            {selected?.status === 'ready' && selected.id !== data.activeGenerationId && (
              <label className="mt-4 flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  className="focus-ring mt-1 h-5 w-5 shrink-0 accent-accent"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                {t('reviewed')}
              </label>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading font-medium text-ink">{t('history')}</h3>
                <button
                  className={button}
                  disabled={busy || query.isFetching}
                  onClick={() => void refresh()}
                >
                  {t('refresh')}
                </button>
              </div>
              {data.history.length === 0 && (
                <p className="mt-2 text-sm text-ink-3">{t('emptyHistory')}</p>
              )}
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {data.history.map((g) => (
                  <button
                    key={g.id}
                    className={cn(
                      button,
                      'flex w-full items-center justify-between gap-3 text-left',
                      selected?.id === g.id && 'border-accent',
                    )}
                    aria-pressed={selected?.id === g.id}
                    onClick={() => {
                      setSelectedId(g.id);
                      setReviewed(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block">
                        {g.category === 'scene' ? t('sceneHistory') : t('enhanceHistory')} ·{' '}
                        {new Date(g.createdAt).toLocaleString('uk-UA', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{g.prompt}</span>
                    </span>
                    <span className="shrink-0 text-xs">
                      {g.id === data.activeGenerationId ? t('applied') : t(`status.${g.status}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            {!data.enabled && <Banner tone="info">{data.reason ?? t('unavailable')}</Banner>}
            <div className="grid grid-cols-2 gap-2" aria-label={t('mode')}>
              {(['enhance', 'scene'] as const).map((value) => (
                <button
                  key={value}
                  className={cn(
                    button,
                    category === value && 'border-accent bg-accent/10 text-accent',
                  )}
                  aria-pressed={category === value}
                  onClick={() => chooseCategory(value)}
                >
                  {value === 'enhance' ? t('enhance') : t('scene')}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.builtins
                .filter((preset) => preset.category === category)
                .map((preset) => (
                  <button
                    key={preset.id}
                    className={cn(button, 'text-left')}
                    onClick={() => choosePreset(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
            </div>
            {category === 'scene' && (
              <button
                className={button}
                aria-expanded={constructor}
                onClick={() => setConstructor((value) => !value)}
              >
                {t('customScene')}
              </button>
            )}
            {category === 'scene' && constructor && (
              <div className="space-y-3 border border-line p-3">
                <Label text={t('background')}>
                  <input
                    className={input}
                    maxLength={300}
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                  />
                </Label>
                <Label text={t('time')}>
                  <input
                    className={input}
                    maxLength={100}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Label>
                <Label text={t('lighting')}>
                  <input
                    className={input}
                    maxLength={300}
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                  />
                </Label>
                <Label text={t('extra')}>
                  <textarea
                    className={input}
                    rows={2}
                    maxLength={1500}
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  />
                </Label>
                <button
                  className={button}
                  onClick={() => setPrompt(scenePrompt(background, time, lighting, extra))}
                >
                  {t('buildPrompt')}
                </button>
              </div>
            )}
            <Label text={t('prompt')}>
              <textarea
                className={input}
                rows={6}
                maxLength={4000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </Label>
            <p className="text-xs leading-relaxed text-ink-3">
              {t('protection')} {category === 'scene' ? t('sceneHint') : t('enhanceHint')}
            </p>
            {data.presets.length > 0 && (
              <Label text={t('myPresets')}>
                <select
                  className={input}
                  value=""
                  onChange={(e) => {
                    const preset = data.presets.find((p) => p.id === e.target.value);
                    if (preset) choosePreset(preset);
                  }}
                >
                  <option value="">{t('choosePreset')}</option>
                  {data.presets.map((preset) => (
                    <option value={preset.id} key={preset.id}>
                      {preset.name} ·{' '}
                      {preset.category === 'scene' ? t('sceneShort') : t('enhanceShort')}
                    </option>
                  ))}
                </select>
              </Label>
            )}
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label text={t('presetName')}>
                  <input
                    className={input}
                    maxLength={80}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                </Label>
              </div>
              <button
                className={button}
                disabled={busy || !presetName.trim() || prompt.trim().length < 5}
                onClick={() =>
                  void action(async () => {
                    await photoAiApi.savePreset({
                      name: presetName.trim(),
                      category,
                      prompt: prompt.trim(),
                    });
                    await refresh();
                    setPresetName('');
                    setNotice(t('presetSaved'));
                  })
                }
              >
                {t('savePreset')}
              </button>
            </div>
            <button
              className={cn(button, 'w-full bg-accent text-on-accent border-accent')}
              disabled={!canGenerate}
              onClick={() =>
                void action(async () => {
                  attempt.current = generationAttempt(attempt.current, category, prompt);
                  const generation = await photoAiApi.generate(mediaId, attempt.current);
                  attempt.current = null;
                  setSelectedId(generation.id);
                  setReviewed(false);
                  await refresh();
                })
              }
            >
              {busy
                ? t('wait')
                : selected?.status === 'interrupted' || selected?.status === 'failed'
                  ? t('newVariant')
                  : t('generate')}
            </button>
            <p className="text-xs text-ink-3">{t('generationHint')}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-ink-2">{text}</span>
      {children}
    </label>
  );
}
function CompareImage({
  label,
  src,
  empty,
}: {
  label: string;
  src?: string | null;
  empty?: string;
}) {
  const t = useTranslations('admin.photoAi');
  return (
    <figure className="min-w-0 border border-line bg-surface-2">
      <figcaption className="border-b border-line px-3 py-2 text-xs font-medium text-ink-2">
        {label}
      </figcaption>
      <div className="flex aspect-[4/3] items-center justify-center">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <p className="px-4 text-center text-sm text-ink-3">{empty}</p>
        )}
      </div>
      {src && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring block border-t border-line px-3 py-3 text-xs text-accent"
        >
          {t('fullSize')}
        </a>
      )}
    </figure>
  );
}
