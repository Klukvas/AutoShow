import { readServerToken } from '@/lib/auth/refresh';
import { apiFetch } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

/** Read-only operator diagnostics; frontend never receives backend env/secrets. */
export async function GET() {
  const auth = await readServerToken();
  if (!auth) return Response.json({ message: 'Unauthorized' }, { status: 401 });
  if (auth.session.user.role !== 'admin')
    return Response.json({ message: 'Forbidden' }, { status: 403 });
  try {
    const backend = await apiFetch<unknown>('/admin/installation', {
      accessToken: auth.accessToken,
      cache: 'no-store',
    });
    return Response.json(
      { frontendVersion: process.env.FRONTEND_VERSION ?? 'development', backend },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json({ message: 'Diagnostics unavailable' }, { status: 503 });
  }
}
