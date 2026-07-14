'use server';

import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { readSession, writeSession, clearSession } from './session';

export type LoginErrorCode = 'required' | 'invalid' | 'rate_limited' | 'generic';

export interface LoginActionState {
  error: LoginErrorCode;
  /** Monotonic marker so identical consecutive errors still re-trigger effects. */
  at: number;
}

/**
 * Returns an error CODE (not copy) — the client translates it and drives the
 * lockout counter (handoff 1a) off `invalid` results.
 */
export async function loginAction(
  _prev: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return { error: 'required', at: Date.now() };
  }
  try {
    const result = await adminApi.login({ email, password });
    const now = Math.floor(Date.now() / 1000);
    await writeSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresAt: now + result.accessExpiresIn,
      refreshExpiresAt: now + result.refreshExpiresIn,
      user: result.user,
    });
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.status === 401) return { error: 'invalid', at: Date.now() };
      if (err.status === 403 || err.status === 429) {
        return { error: 'rate_limited', at: Date.now() };
      }
    }
    return { error: 'generic', at: Date.now() };
  }
  redirect('/admin/listings');
}

export async function logoutAction() {
  const session = await readSession();
  if (session) {
    try {
      await adminApi.logout(session.refreshToken);
    } catch {
      // best-effort
    }
  }
  await clearSession();
  redirect('/admin/login');
}
