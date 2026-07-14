import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { ApiClientError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin';
import { readSession, writeSession, clearSession, type AdminSession } from './session';

const REFRESH_MARGIN_SEC = 30;

/**
 * WHY THIS IS SPLIT
 * -----------------
 * Next.js 15 only permits cookie writes in Server Actions and Route Handlers.
 * The old single `getValidAccessToken()` rotated the refresh token and wrote a
 * cookie during Server Component render, which throws (ReadonlyRequestCookies),
 * loses the rotated token, and — because the old token was already consumed on
 * the backend — trips replay detection and destroys the whole session.
 *
 * So:
 *   • RSC render uses the READ-ONLY `readServerToken()` / `requireServerToken()`
 *     — they never rotate and never write cookies.
 *   • Rotation happens ONLY in `refreshSession()`, called exclusively from Route
 *     Handlers (`/admin/api/token`, `/admin/refresh`) where cookie writes are legal.
 */

export interface ServerAuth {
  session: AdminSession;
  accessToken: string;
}

/** Read-only, RSC-safe: returns a still-valid access token or null. Never writes. */
export async function readServerToken(): Promise<ServerAuth | null> {
  const session = await readSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.accessExpiresAt - REFRESH_MARGIN_SEC > now) {
    return { session, accessToken: session.accessToken };
  }
  return null; // stale — caller must route through a refresh Route Handler
}

/**
 * RSC helper: returns a valid token, or performs a redirect that never returns.
 * A stale token bounces through `/admin/refresh` (a Route Handler that CAN
 * rotate + persist) and comes back to `nextPath`.
 */
export async function requireServerToken(nextPath: string): Promise<ServerAuth> {
  const auth = await readServerToken();
  if (auth) return auth;
  const session = await readSession();
  if (!session) redirect('/admin/login');
  redirect(`/admin/refresh?next=${encodeURIComponent(nextPath)}`);
}

// Cross-call dedup within this process: concurrent refreshes of the SAME token
// share one backend rotation, so we never send the single-use token twice and
// trip replay detection. Keyed by a hash of the refresh token.
const inFlight = new Map<string, Promise<AdminSession | null>>();

function keyFor(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

async function rotateOnce(session: AdminSession): Promise<AdminSession | null> {
  try {
    const fresh = await adminApi.refresh(session.refreshToken);
    const now = Math.floor(Date.now() / 1000);
    return {
      ...session,
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      accessExpiresAt: now + fresh.accessExpiresIn,
      refreshExpiresAt: now + fresh.refreshExpiresIn,
    };
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Cookie-writing refresh — ONLY safe in Route Handlers / Server Actions.
 * Returns a valid token, refreshing (and persisting) if the current one is
 * stale. Returns null if there is no session or the refresh was rejected.
 */
export async function refreshSession(): Promise<ServerAuth | null> {
  const session = await readSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.accessExpiresAt - REFRESH_MARGIN_SEC > now) {
    return { session, accessToken: session.accessToken };
  }

  const key = keyFor(session.refreshToken);
  let promise = inFlight.get(key);
  if (!promise) {
    promise = rotateOnce(session).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
  }
  const rotated = await promise;
  if (!rotated) {
    await clearSession();
    return null;
  }
  // Each caller persists to its own request cookie store (idempotent — same
  // value); the backend rotation itself ran exactly once via the shared promise.
  await writeSession(rotated);
  return { session: rotated, accessToken: rotated.accessToken };
}
