'use client';

/**
 * Fetch the current admin access token from the same-origin internal route.
 * The endpoint is no-store and returns null when the session expired so
 * callers can show a "session expired" message instead of a generic error.
 *
 * Used by client components that need to call the backend admin API
 * directly (status transitions, branding save, media upload). Keeps the
 * token out of the page HTML / RSC payload.
 */
export async function fetchAccessToken(): Promise<string | null> {
  const res = await fetch('/admin/api/token', { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { accessToken: string | null };
  return body.accessToken;
}
