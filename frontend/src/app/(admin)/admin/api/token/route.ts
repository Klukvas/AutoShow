import { NextResponse } from 'next/server';
import { refreshSession } from '@/lib/auth/refresh';

/**
 * Internal token endpoint for client components that need to call the
 * backend's admin API (e.g. status transitions, media upload). It only ever
 * exposes the current access token to the SAME origin under the admin cookie,
 * not to the public site — paired with HttpOnly cookie, it's the simplest
 * way to keep the token off the page HTML.
 */
export async function GET(request: Request) {
  // Defense-in-depth against cross-site fetches: modern browsers stamp
  // Sec-Fetch-Site; anything other than same-origin (or an absent header on
  // older browsers) gets a bare 403 instead of a token.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return NextResponse.json({ accessToken: null }, { status: 403 });
  }
  // A Route Handler may write cookies, so refreshing (rotating) here is safe.
  const auth = await refreshSession();
  return NextResponse.json(
    { accessToken: auth?.accessToken ?? null },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    },
  );
}
