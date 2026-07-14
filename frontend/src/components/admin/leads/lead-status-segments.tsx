'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { adminApi, type AdminLead } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';

type Status = AdminLead['status'];

/** The 3 working states (handoff 1f); spam is a separate quiet action. */
const SEGMENTS: Status[] = ['new', 'in_progress', 'done'];

export function LeadStatusSegments({ id, status }: { id: string; status: Status }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: Status) => {
    if (busy || next === status) return;
    setBusy(true);
    setError(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      await adminApi.updateLeadStatus(id, next, { accessToken });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12.5px] font-semibold text-ink-2">{t('leads.statusLabel')}</span>
      <div role="group" aria-label={t('leads.statusLabel')} className="flex gap-[7px]">
        {SEGMENTS.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => change(s)}
              className={cn(
                'focus-ring min-h-[38px] rounded-[9px] border px-3.5 text-[12.5px] transition-none disabled:opacity-60',
                active
                  ? 'border-accent bg-accent/[0.08] font-bold text-accent-hover'
                  : 'border-line-input bg-surface font-semibold text-ink-2 hover:border-line-hover',
              )}
            >
              {t(`leadStatus.${s}`)}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => change(status === 'spam' ? 'new' : 'spam')}
        className="focus-ring rounded-[6px] text-[12px] font-semibold text-ink-3 underline-offset-2 hover:text-ink-2 hover:underline disabled:opacity-60"
      >
        {status === 'spam' ? t('leads.unspam') : t('leads.spamAction')}
      </button>
      {error && (
        <p role="alert" className="w-full text-[12px] font-medium text-danger">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
