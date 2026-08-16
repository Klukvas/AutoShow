'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, type AdminLead, type AdminLeadNote, type LeadAssignee } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';

interface LeadCrmPanelProps {
  lead: Pick<AdminLead, 'id' | 'assigneeId' | 'followUpAt'>;
  assignees: LeadAssignee[];
  initialNotes: AdminLeadNote[];
}

/** ISO → value for <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadCrmPanel({ lead, assignees, initialNotes }: LeadCrmPanelProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState(() => toLocalInput(lead.followUpAt));
  const [notes, setNotes] = useState<AdminLeadNote[]>(initialNotes);
  const [draft, setDraft] = useState('');

  const emailOf = (id: string | null) =>
    id ? (assignees.find((a) => a.id === id)?.email ?? id) : null;

  const run = async (fn: (token: string) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setError(t('common.sessionExpired'));
        return;
      }
      await fn(token);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setBusy(false);
    }
  };

  const changeAssignee = (value: string) =>
    void run(async (token) => {
      await adminApi.assignLead(lead.id, value || null, { accessToken: token });
      router.refresh();
    });

  const saveFollowUp = () =>
    void run(async (token) => {
      const iso = followUp ? new Date(followUp).toISOString() : null;
      await adminApi.setLeadFollowUp(lead.id, iso, { accessToken: token });
      router.refresh();
    });

  const clearFollowUp = () =>
    void run(async (token) => {
      await adminApi.setLeadFollowUp(lead.id, null, { accessToken: token });
      setFollowUp(''); // only clear the input after the server confirms
      router.refresh();
    });

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    void run(async (token) => {
      const note = await adminApi.addLeadNote(lead.id, text, { accessToken: token });
      setNotes((prev) => [note, ...prev]);
      setDraft('');
    });
  };

  return (
    <div className="mt-[26px] border-t border-line pt-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Assignee */}
        <div>
          <label
            htmlFor={`assignee-${lead.id}`}
            className="mb-1.5 block text-[11.5px] font-medium text-ink-3"
          >
            {t('leads.assignLabel')}
          </label>
          <select
            id={`assignee-${lead.id}`}
            value={lead.assigneeId ?? ''}
            disabled={busy}
            onChange={(e) => changeAssignee(e.target.value)}
            className="focus-ring h-10 w-full rounded-[9px] border border-line-input bg-surface px-3 text-[13px] font-semibold text-ink disabled:opacity-60"
          >
            <option value="">{t('leads.unassigned')}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </div>

        {/* Follow-up */}
        <div>
          <label
            htmlFor={`followup-${lead.id}`}
            className="mb-1.5 block text-[11.5px] font-medium text-ink-3"
          >
            {t('leads.followUpLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`followup-${lead.id}`}
              type="datetime-local"
              value={followUp}
              disabled={busy}
              onChange={(e) => setFollowUp(e.target.value)}
              className="focus-ring h-10 min-w-0 flex-1 rounded-[9px] border border-line-input bg-surface px-3 text-[13px] font-semibold text-ink disabled:opacity-60"
            />
            <button
              type="button"
              onClick={saveFollowUp}
              disabled={busy}
              className="focus-ring h-10 flex-none rounded-[9px] bg-ink px-3 text-[12.5px] font-bold text-bg disabled:opacity-60"
            >
              {t('common.save')}
            </button>
            {lead.followUpAt && (
              <button
                type="button"
                onClick={clearFollowUp}
                disabled={busy}
                aria-label={t('leads.followUpClear')}
                className="focus-ring h-10 flex-none rounded-[9px] border border-line-input px-3 text-[12.5px] font-semibold text-ink-2 disabled:opacity-60"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes thread */}
      <div className="mt-5">
        <h3 className="mb-2 text-[12.5px] font-bold text-ink">{t('leads.notesTitle')}</h3>
        <div className="flex gap-2">
          <textarea
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('leads.notePlaceholder')}
            rows={2}
            className="focus-ring min-h-[44px] flex-1 resize-y rounded-[9px] border border-line-input bg-surface px-3 py-2 text-[13px] text-ink disabled:opacity-60"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={busy || !draft.trim()}
            className="focus-ring h-10 flex-none self-end rounded-[9px] bg-accent px-3.5 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {t('leads.noteAdd')}
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="mt-3 text-[12.5px] font-medium text-ink-3">{t('leads.notesEmpty')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {notes.map((note) => (
              <li key={note.id} className="rounded-[10px] border border-line bg-surface-2 p-3">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                  {note.text}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-ink-3">
                  {emailOf(note.authorId) ?? note.authorRole ?? '—'} ·{' '}
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-danger">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
