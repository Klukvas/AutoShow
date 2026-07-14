import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import type { AdminRole } from '../api/admin';

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME ?? 'autoflow_admin';
// Secure by default in production (the cookie carries the access + 30-day
// refresh token). Only an explicit ADMIN_COOKIE_SECURE=false opts out, for
// local HTTP development.
const SECURE =
  process.env.NODE_ENV === 'production'
    ? process.env.ADMIN_COOKIE_SECURE !== 'false'
    : process.env.ADMIN_COOKIE_SECURE === 'true';
const DOMAIN = process.env.ADMIN_COOKIE_DOMAIN || undefined;
const SIGNING_KEY = process.env.ADMIN_COOKIE_SIGNING_KEY;

const DEV_FALLBACK_KEY = 'dev-only-do-not-use-in-prod';
const KNOWN_DEV_KEYS = [DEV_FALLBACK_KEY, 'dev-local-signing-key-not-for-prod-use'];

// `next build` also runs with NODE_ENV=production while collecting page
// data — the guard must only gate the actual serving runtime.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

if (
  !IS_BUILD_PHASE &&
  process.env.NODE_ENV === 'production' &&
  (!SIGNING_KEY || KNOWN_DEV_KEYS.includes(SIGNING_KEY))
) {
  // Fail-fast at boot — running prod with a missing OR well-known dev signing
  // key means anyone can forge the admin session cookie.
  throw new Error('ADMIN_COOKIE_SIGNING_KEY must be set to a unique secret in production');
}

const KEY = SIGNING_KEY ?? DEV_FALLBACK_KEY;

const VALID_ROLES: readonly string[] = ['admin', 'editor'];

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  user: {
    id: string;
    email: string;
    role: AdminRole;
  };
}

/**
 * Cookie format: `<base64url(payload)>.<base64url(hmac)>`.
 * HMAC-SHA256 over the payload with `ADMIN_COOKIE_SIGNING_KEY` — tampering is
 * detected and the cookie is treated as missing (logs the user out cleanly).
 * Still HttpOnly + sameSite=lax to keep cookies off the page surface.
 */
function sign(payload: string): string {
  return createHmac('sha256', KEY).update(payload).digest('base64url');
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const a = Buffer.from(signature, 'base64url');
  const b = Buffer.from(expected, 'base64url');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const readSession = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !verify(payload, signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
    // Cookies minted before the role model change carry stale roles
    // (`tenant_admin`, `super_admin`) — treat them as logged out.
    if (!VALID_ROLES.includes(session.user?.role)) return null;
    return session;
  } catch {
    return null;
  }
});

export async function writeSession(session: AdminSession): Promise<void> {
  const store = await cookies();
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signed = `${payload}.${sign(payload)}`;
  store.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    domain: DOMAIN,
    path: '/',
    maxAge: Math.max(60, session.refreshExpiresAt - Math.floor(Date.now() / 1000)),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
