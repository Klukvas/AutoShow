export const dynamic = 'force-dynamic';

/** Non-sensitive release proof used by the local ingress deployment gate. */
export function GET() {
  return Response.json(
    { status: 'ok', version: process.env.FRONTEND_VERSION ?? 'development' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
