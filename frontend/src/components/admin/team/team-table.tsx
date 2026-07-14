'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { adminApi, type AdminUser } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { Banner } from '@/components/admin/ui/banner';
import { UserStatusBadge } from '@/components/admin/ui/badges';
import { Dialog } from '@/components/admin/ui/dialog';
import { CreateEditorDialog } from './create-editor-dialog';

interface TeamTableProps {
  users: AdminUser[];
  currentUserId: string;
}

/** Deterministic avatar colour per email (handoff palette). */
const AVATAR_COLORS = ['#2E53E6', '#1F9D57', '#B67B00', '#C23B57', '#8C929E'];

export function avatarColor(email: string): string {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Handoff 1g. The last admin can't be deleted — the action is disabled with
 * an explainer row, not hidden (people must learn WHY it's off).
 */
export function TeamTable({ users, currentUserId }: TeamTableProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adminCount = users.filter((u) => u.role === 'admin').length;

  const run = async (id: string, fn: (token: string) => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const token = await fetchAccessToken();
      if (!token) {
        setError(t('common.sessionExpired'));
        return;
      }
      await fn(token);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setBusyId(null);
    }
  };

  const actionBtn =
    'focus-ring rounded-[6px] px-1.5 py-2 text-[12px] font-semibold transition-none disabled:cursor-not-allowed';

  const rowActions = (u: AdminUser) => {
    if (u.id === currentUserId) {
      return <span className="text-[12px] font-semibold text-ink-3">{t('team.you')}</span>;
    }
    const lastAdmin = u.role === 'admin' && adminCount <= 1;
    return (
      <>
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() =>
            void run(u.id, (token) =>
              adminApi.updateUser(u.id, { isActive: !u.isActive }, { accessToken: token }),
            )
          }
          className={cn(actionBtn, 'text-ink-2 hover:text-ink')}
        >
          {t(u.isActive ? 'team.block' : 'team.activate')}
        </button>
        <button
          type="button"
          disabled={busyId !== null || lastAdmin}
          aria-disabled={lastAdmin || undefined}
          title={lastAdmin ? t('team.lastAdminNote') : undefined}
          onClick={() => setToDelete(u)}
          className={cn(actionBtn, lastAdmin ? 'text-ink-3/60' : 'text-danger hover:text-danger')}
        >
          {t('common.delete')}
        </button>
      </>
    );
  };

  const avatar = (u: AdminUser) => (
    <span
      aria-hidden
      style={{ background: avatarColor(u.email) }}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white"
    >
      {u.email[0]?.toUpperCase()}
    </span>
  );

  const roleCell = (u: AdminUser) => (
    <span
      className={cn(
        'text-[12.5px] font-semibold',
        u.role === 'admin' ? 'text-accent' : 'text-ink-2',
      )}
    >
      {t(`nav.role.${u.role}`)}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-[22px] md:py-5">
        <h1 className="font-heading text-[20px] font-extrabold tracking-tight">{t('team.title')}</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="focus-ring inline-flex h-10 items-center rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover"
        >
          {t('team.create')}
        </button>
      </div>

      {error && (
        <Banner tone="error" className="m-3">
          {error}
        </Banner>
      )}

      {/* Desktop table */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="bg-thead text-left text-[11px] font-bold uppercase tracking-[0.05em] text-ink-3">
            <th className="px-[22px] py-[11px] font-bold">{t('team.colMember')}</th>
            <th className="w-[120px] px-2 py-[11px] font-bold">{t('team.colRole')}</th>
            <th className="w-[140px] px-2 py-[11px] font-bold">{t('team.colStatus')}</th>
            <th className="w-[190px] px-2 py-[11px]" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line/70">
              <td className="px-[22px] py-[13px]">
                <div className="flex items-center gap-2.5">
                  {avatar(u)}
                  <span className="text-[13.5px] font-semibold text-ink">{u.email}</span>
                </div>
              </td>
              <td className="px-2 py-[13px]">{roleCell(u)}</td>
              <td className="px-2 py-[13px]">
                <UserStatusBadge isActive={u.isActive} />
              </td>
              <td className="px-2 py-[13px] pr-[22px]">
                <div className="flex items-center justify-end gap-[7px]">{rowActions(u)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="md:hidden">
        {users.map((u) => (
          <li key={u.id} className="border-t border-line/70 px-4 py-3.5 first:border-t-0">
            <div className="flex items-center gap-2.5">
              {avatar(u)}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">{u.email}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {roleCell(u)}
                  <UserStatusBadge isActive={u.isActive} />
                </div>
              </div>
            </div>
            <div className="mt-1 flex justify-end gap-2">{rowActions(u)}</div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-4 py-3 text-[12px] font-medium text-ink-3 md:px-[22px]">
        <span aria-hidden>ℹ</span> {t('team.lastAdminNote')}
      </div>

      <CreateEditorDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <Dialog
        open={toDelete !== null}
        onClose={() => (busyId ? null : setToDelete(null))}
        title={t('team.deleteTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={busyId !== null}
              className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => {
                if (!toDelete) return;
                const target = toDelete;
                void run(target.id, (token) =>
                  adminApi.deleteUser(target.id, { accessToken: token }),
                ).then(() => setToDelete(null));
              }}
              className="focus-ring h-10 rounded-[9px] bg-danger px-4 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {busyId ? t('common.saving') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] font-medium leading-relaxed text-ink-2">
          {toDelete && t('team.deleteBody', { email: toDelete.email })}
        </p>
      </Dialog>
    </div>
  );
}
