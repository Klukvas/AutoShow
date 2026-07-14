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
    <main className="flex min-h-dvh flex-col bg-[#14161B] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
        {/* Brand */}
        <div className="mb-7 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent font-heading text-[16px] font-extrabold text-on-accent"
          >
            A
          </span>
          <span className="font-heading text-[19px] font-extrabold tracking-tight">AutoFlow</span>
          <span className="mt-0.5 rounded-[5px] border border-white/20 px-[7px] py-[2px] text-[10px] font-semibold text-[#9BA0AB]">
            {t('badge')}
          </span>
        </div>

        <h1 className="font-heading text-[22px] font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-[5px] text-[13px] text-[#9BA0AB]">{t('subtitle')}</p>

        {/* Lockout block */}
        {locked && (
          <div
            role="alert"
            className="mt-6 rounded-[13px] border border-[#F3E2B8]/40 bg-[#FFF9EC] p-[18px] text-left"
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="text-[20px]">
                🔒
              </span>
              <span className="font-heading text-[16px] font-bold text-[#8A6300]">
                {t('lockTitle')}
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#9A7A2E]">
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
            className="mb-1.5 block text-[12px] font-semibold text-[#C7CAD1]"
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
              'focus-ring mb-4 h-[46px] w-full rounded-[10px] border bg-white/5 px-3.5 text-[14px] font-medium text-white outline-none transition-none',
              'placeholder:text-[#7C818C] disabled:opacity-50',
              'border-white/[0.14]',
            )}
          />
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-[12px] font-semibold text-[#C7CAD1]"
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
              'focus-ring h-[46px] w-full rounded-[10px] px-3.5 text-[14px] font-medium outline-none transition-none disabled:opacity-50',
              invalid
                ? 'border-[1.5px] border-[#D9534F] bg-[#FDF3F2] text-ink'
                : 'border border-white/[0.14] bg-white/5 text-white',
            )}
          />
          {invalid && (
            <p
              id="login-error"
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[#E07B70]"
            >
              <span aria-hidden>⚠</span>
              {state?.error === 'required' ? t('errorRequired') : t('errorInvalid')}
            </p>
          )}
          {!locked && state?.error === 'generic' && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#E07B70]">
              ⚠ {t('errorGeneric')}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled}
            className={cn(
              'focus-ring mt-[22px] h-[50px] w-full rounded-[11px] text-[15px] font-bold transition-colors',
              disabled && locked
                ? 'cursor-not-allowed bg-[#2A2D34] text-[#7C818C]'
                : 'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-70',
            )}
          >
            {pending ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </main>
  );
}
