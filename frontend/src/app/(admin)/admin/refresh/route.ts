import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/auth/refresh';

/**
 * Route Handler that RSC pages bounce through when their access token is stale.
 * Unlike Server Component render, a Route Handler MAY write cookies, so the
 * refresh-token rotation is persisted here, then we redirect back to `next`.
 */
export async function GET(req: NextRequest) {
  const nextParam = req.nextUrl.searchParams.get('next') ?? '/admin/listings';
  // Only allow same-app admin paths as the redirect target (no open redirect).
  const next = nextParam.startsWith('/admin/') ? nextParam : '/admin/listings';

  const auth = await refreshSession();
  if (!auth) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.redirect(new URL(next, req.url));
}
