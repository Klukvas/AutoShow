'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { loginAction } from '@/lib/auth/actions';
import {
  INITIAL_LOCKOUT,
  MAX_ATTEMPTS,
  formatCountdown,
  isLocked,
  readStoredLockout,
  registerFailure,
  registerRateLimit,
  remainingSeconds,
  writeStoredLockout,
  type LockoutState,
} from '@/lib/admin/lockout';

/**
 * Handoff 1a — the panel's single public screen. Always dark (independent of
 * the workspace theme): #14161B canvas, brand mark + «Адмін» chip, then the
 * three states — normal, field error, lockout with a live countdown.
 */
export default function AdminLoginPage() {
  const t = useTranslations('admin.login');
  const [state, action, pending] = useActionState(loginAction, null);
  const [lockout, setLockout] = useState<LockoutState>(INITIAL_LOCKOUT);
  const [now, setNow] = useState(() => Date.now());

  // Restore a persisted lockout (page reloads must not reset the timer).
  useEffect(() => {
    setLockout(readStoredLockout(window.localStorage));
  }, []);

  // Feed failed attempts into the lockout state machine.
  useEffect(() => {
    if (!state) return;
    setLockout((prev) => {
      const next =
        state.error === 'invalid'
          ? registerFailure(prev, Date.now())
          : state.error === 'rate_limited'
            ? registerRateLimit(prev, Date.now())
            : prev;
      if (next !== prev) writeStoredLockout(window.localStorage, next);
      return next;
    });
  }, [state]);

  // Tick the countdown once a second while locked.
  const locked = isLocked(lockout, now);
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const invalid = !locked && (state?.error === 'invalid' || state?.error === 'required');
  const disabled = pending || locked;

  return (
    <main className="cinematic-login flex min-h-dvh flex-col px-6 py-10">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
        {/* Brand */}
        <div className="mb-7 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-none bg-transparent font-heading text-[1rem] font-medium text-lot-gold"
          >
            A
          </span>
          <span className="cinematic-wordmark">
            AutoFlow
          </span>
          <span className="mt-0.5 rounded-none border border-white/20 px-[7px] py-[2px] text-[0.625rem] font-medium text-ink-3">
            {t('badge')}
          </span>
        </div>

        <h1 className="font-heading text-[1.375rem] font-medium tracking-tight">{t('title')}</h1>
        <p className="mt-[5px] text-[0.8125rem] text-ink-3">{t('subtitle')}</p>

        {/* Lockout block */}
        {locked && (
          <div
            role="alert"
            className="mt-6 rounded-none border border-ratelimit-line bg-ratelimit-bg p-[18px] text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-heading text-[1rem] font-medium text-ratelimit">
                {t('lockTitle')}
              </span>
            </div>
            <p className="mt-2 text-[0.8125rem] font-medium leading-relaxed text-ratelimit-2">
              {t('lockBody', {
                count: MAX_ATTEMPTS,
                time: formatCountdown(remainingSeconds(lockout, now)),
              })}
            </p>
          </div>
        )}

        <form action={action} className="mt-6" aria-busy={pending}>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-[0.75rem] font-medium text-ink-2"
          >
            {t('email')}
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="username"
            disabled={locked}
            className={cn(
              'focus-ring mb-4 h-[46px] w-full rounded-none border bg-white/5 px-3.5 text-[0.875rem] font-medium text-white outline-none transition-none',
              'placeholder:text-ink-3 disabled:opacity-50',
              'border-white/[0.14]',
            )}
          />
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-[0.75rem] font-medium text-ink-2"
          >
            {t('password')}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={locked}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'login-error' : undefined}
            className={cn(
              'focus-ring h-[46px] w-full rounded-none px-3.5 text-[0.875rem] font-medium outline-none transition-none disabled:opacity-50',
              invalid
                ? 'border-[1.5px] border-danger bg-danger-bg text-ink'
                : 'border border-white/[0.14] bg-white/5 text-white',
            )}
          />
          {invalid && (
            <p
              id="login-error"
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-[0.78125rem] font-medium text-danger"
            >
              <span aria-hidden>⚠</span>
              {state?.error === 'required' ? t('errorRequired') : t('errorInvalid')}
            </p>
          )}
          {!locked && state?.error === 'generic' && (
            <p role="alert" className="mt-2 text-[0.78125rem] font-medium text-danger">
              ⚠ {t('errorGeneric')}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled}
            className={cn(
              'focus-ring mt-[22px] h-[50px] w-full rounded-none text-[0.9375rem] font-medium transition-colors',
              disabled && locked
                ? 'cursor-not-allowed bg-surface-2 text-ink-3'
                : 'platform-primary disabled:opacity-70',
            )}
          >
            {pending ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </main>
  );
}
