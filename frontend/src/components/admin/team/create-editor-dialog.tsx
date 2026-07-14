'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import { Banner } from '@/components/admin/ui/banner';
import { Dialog } from '@/components/admin/ui/dialog';
import { TextField } from '@/components/admin/ui/field';

const MIN_PASSWORD = 12;

/** «+ Створити editor» modal (handoff 1g): email + temporary password. */
export function CreateEditorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setError(null);
    setSuccess(null);
    onClose();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(data.get('password') ?? '');

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      await adminApi.createUser({ email, password }, { accessToken });
      form.reset();
      setSuccess(t('team.created', { email }));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) setError(t('team.emailTaken'));
      else if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title={t('team.dialogTitle')}>
      <p className="mb-4 text-[12.5px] font-medium leading-relaxed text-ink-3">
        {t('team.dialogSubtitle')}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <TextField
          label={t('team.email')}
          name="email"
          type="email"
          required
          autoComplete="off"
          data-autofocus
        />
        <TextField
          label={t('team.tempPassword')}
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={128}
          autoComplete="new-password"
          hint={t('team.passwordHint')}
        />
        {error && <Banner tone="error">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="focus-ring h-10 rounded-[9px] border border-line-input bg-surface px-4 text-[13px] font-semibold text-ink"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="focus-ring h-10 rounded-[9px] bg-accent px-4 text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? t('team.creating') : t('team.createCta')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
