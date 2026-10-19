'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Banner } from '@/components/admin/ui/banner';
import { SectionCard } from '@/components/admin/ui/section-card';
import { cn } from '@/lib/cn';
import { ApiClientError } from '@/lib/api/client';
import {
  LISTING_AI_FIELDS,
  LISTING_AI_PRESETS,
  draftAttempt,
  isDraftRunning,
  listingAiApi,
  relevantFlags,
  type DraftAttempt,
  type ListingAiDraft,
  type ListingAiField,
  type ListingAiPreset,
} from '@/lib/admin/listing-ai';
import { ListingAiFlags } from './listing-ai-flags';

const button =
  'focus-ring min-h-10 border border-line-input bg-surface px-3 py-2 text-sm font-medium text-ink disabled:opacity-50';
const POLL_MS = 3000;
const HISTORY_SHOWN = 5;
const SEO_FIELDS: readonly ListingAiField[] = ['metaTitle', 'metaDescription'];

type Saved = Record<ListingAiField, string>;

/**
 * Drafts a description and SEO texts with AI. Texts go into the form only
 * when the owner takes them, and into the listing only on the normal save.
 */
export function ListingAiPanel({
  listingId,
  saved,
  onApply,
}: {
  listingId: string;
  /** The saved listing texts the draft is compared with. */
  saved: Saved;
  /** Puts the taken texts into the form fields. */
  onApply: (values: Partial<Saved>) => void;
}) {
  const t = useTranslations('admin.listingAi');
  const client = useQueryClient();
  const workspaceKey = useMemo(() => ['listing-ai', listingId], [listingId]);
  const workspace = useQuery({
    queryKey: workspaceKey,
    queryFn: () => listingAiApi.workspace(listingId),
    refetchOnWindowFocus: false,
  });
  const [preset, setPreset] = useState<ListingAiPreset>('standard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef<DraftAttempt | null>(null);

  const data = workspace.data?.permitted ? workspace.data : undefined;
  const listed = data?.drafts.find((d) => d.id === selectedId) ?? data?.drafts[0];
  // Cheap per-draft polling while it runs; the heavy workspace is refetched once at the end.
  const poll = useQuery({
    queryKey: ['listing-ai-draft', listingId, listed?.id],
    queryFn: () => listingAiApi.draft(listingId, listed?.id ?? ''),
    enabled: Boolean(listed && isDraftRunning(listed)),
    refetchInterval: (q) => (q.state.data && !isDraftRunning(q.state.data) ? false : POLL_MS),
  });
  const draft: ListingAiDraft | undefined =
    poll.data && poll.data.id === listed?.id
      ? { ...listed, ...poll.data, isStale: listed.isStale }
      : listed;
  const running = Boolean(draft && isDraftRunning(draft));

  // Polling stops once the draft finishes, so this refetches the workspace once.
  useEffect(() => {
    if (poll.data && !isDraftRunning(poll.data))
      void client.invalidateQueries({ queryKey: workspaceKey });
  }, [poll.data, client, workspaceKey]);
  useEffect(() => setConfirmed(false), [draft?.id]);

  if (workspace.data && !workspace.data.permitted) return null;

  /** The global throttler answers in English; the service's own 429 is already Ukrainian. */
  const messageOf = (e: unknown) =>
    e instanceof ApiClientError && e.status === 429 && /^ThrottlerException/.test(e.message)
      ? t('rateLimited')
      : e instanceof Error
        ? e.message
        : t('error');

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      attempt.current = draftAttempt(attempt.current, preset);
      const created = await listingAiApi.create(listingId, attempt.current);
      attempt.current = null;
      setSelectedId(created.id);
      await client.invalidateQueries({ queryKey: workspaceKey });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function accept(fields: ListingAiField[]) {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const taken = await listingAiApi.accept(listingId, draft.id, {
        fields,
        confirmFlags: confirmed,
      });
      onApply(taken);
      setNotice(t('applied'));
      await client.invalidateQueries({ queryKey: workspaceKey });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const staleFields = data
    ? LISTING_AI_FIELDS.filter((field) => data.accepted[field]?.isStale)
    : [];
  const needsConfirm = (fields: ListingAiField[]) =>
    Boolean(draft && relevantFlags(draft, fields).length > 0 && !confirmed);

  return (
    <SectionCard title={t('title')}>
      <p className="mb-3 text-sm leading-relaxed text-ink-2">{t('hint')}</p>
      {workspace.isPending && (
        <p role="status" className="text-sm text-ink-3">
          {t('loading')}
        </p>
      )}
      {(workspace.error || error) && (
        <Banner tone="error" className="mb-3">
          {error ?? t('error')}
        </Banner>
      )}
      {notice && (
        <p role="status" className="mb-3 text-sm text-accent">
          {notice}
        </p>
      )}
      {data && (
        <div className="space-y-4">
          {staleFields.length > 0 && (
            <Banner tone="warning" role="status">
              {t('stale', { fields: staleFields.map((field) => t(`field.${field}`)).join(', ') })}
            </Banner>
          )}
          {!data.available && <Banner tone="info">{data.reason ?? t('unavailable')}</Banner>}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('preset')}>
            {LISTING_AI_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={preset === value}
                className={cn(button, preset === value && 'border-accent bg-accent/10 text-accent')}
                onClick={() => setPreset(value)}
              >
                {t(`presets.${value}`)}
              </button>
            ))}
            <button
              type="button"
              className={cn(button, 'bg-accent text-on-accent border-accent')}
              disabled={!data.available || running || busy}
              onClick={() => void generate()}
            >
              {running ? t('generating') : t('generate')}
            </button>
          </div>

          {draft && (
            <div className="space-y-3 border-t border-line pt-4">
              <p role="status" aria-live="polite" className="text-sm text-ink-2">
                {t(`status.${draft.status}`)} · {t(`presets.${draft.preset}`)}
              </p>
              {draft.failureReason && <Banner tone="error">{draft.failureReason}</Banner>}
              {draft.status === 'ready' && draft.result && (
                <>
                  {LISTING_AI_FIELDS.map((field) => (
                    <Compare
                      key={field}
                      label={t(`field.${field}`)}
                      before={saved[field]}
                      after={draft.result?.[field] ?? ''}
                      beforeLabel={t('now')}
                      afterLabel={t('draft')}
                      emptyLabel={t('empty')}
                    />
                  ))}
                  <ListingAiFlags flags={draft.flags} />
                  {draft.flags.length > 0 && (
                    <label className="flex items-start gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="focus-ring mt-1 h-5 w-5 shrink-0"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      {t('confirmFlags')}
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['takeAll', [...LISTING_AI_FIELDS]],
                        ['takeDescription', ['description']],
                        ['takeSeo', [...SEO_FIELDS]],
                      ] as const
                    ).map(([label, fields]) => (
                      <button
                        key={label}
                        type="button"
                        className={button}
                        disabled={busy || needsConfirm([...fields])}
                        aria-describedby={
                          needsConfirm([...fields]) ? 'listing-ai-confirm-reason' : undefined
                        }
                        onClick={() => void accept([...fields])}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                  {draft.flags.length > 0 && !confirmed && (
                    <p id="listing-ai-confirm-reason" className="text-xs text-ink-3">
                      {t('confirmReason')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {data.drafts.length > 1 && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-xs font-medium text-ink-2">{t('history')}</p>
              <div className="flex flex-wrap gap-2">
                {data.drafts.slice(0, HISTORY_SHOWN).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={d.id === draft?.id}
                    className={cn(button, 'text-xs', d.id === draft?.id && 'border-accent')}
                    onClick={() => setSelectedId(d.id)}
                  >
                    {t(`presets.${d.preset}`)} ·{' '}
                    {new Date(d.createdAt).toLocaleString('uk-UA', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {t(`status.${d.status}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function Compare({
  label,
  before,
  after,
  beforeLabel,
  afterLabel,
  emptyLabel,
}: {
  label: string;
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-2">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            [beforeLabel, before],
            [afterLabel, after],
          ] as const
        ).map(([caption, text]) => (
          <div key={caption} className="min-w-0 border border-line bg-surface-2 p-2.5">
            <p className="mb-1 text-[0.6875rem] uppercase tracking-[0.05em] text-ink-3">
              {caption} · {text.length}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-ink">{text || emptyLabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
