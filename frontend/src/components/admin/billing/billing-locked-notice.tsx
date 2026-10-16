import { useTranslations } from 'next-intl';
import { logoutAction } from '@/lib/auth/actions';

/**
 * Full-screen notice for an editor while the subscription is blocked: no
 * navigation at all, just what happened and a way to log out.
 */
export function BillingLockedNotice({ email }: { email: string }) {
  const t = useTranslations('admin');
  return (
    <div className="cinematic-admin flex min-h-dvh items-center justify-center bg-bg px-4 text-ink">
      <div
        role="alert"
        className="w-full max-w-[460px] rounded-none border border-line bg-surface px-6 py-10 text-center"
      >
        <div
          aria-hidden
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg text-[1.25rem] text-danger"
        >
          ⚠
        </div>
        <h1 className="font-heading text-[1.25rem] font-medium tracking-tight">
          {t('billing.blocked.editorTitle')}
        </h1>
        <p className="mt-2 text-[0.875rem] font-medium text-ink-2">
          {t('billing.blocked.editorBody')}
        </p>
        <p className="mt-6 truncate text-[0.75rem] font-medium text-ink-3">{email}</p>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="focus-ring inline-flex h-10 items-center rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink"
          >
            {t('nav.logout')}
          </button>
        </form>
      </div>
    </div>
  );
}
