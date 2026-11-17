import { builtThemeId } from '@/themes/built-theme';

export const dynamic = 'force-dynamic';

/**
 * Non-sensitive release proof used by the local ingress deployment gate; `theme`
 * lets an operator see which storefront design the running image was built with.
 */
export function GET() {
  return Response.json(
    {
      status: 'ok',
      version: process.env.FRONTEND_VERSION ?? 'development',
      theme: builtThemeId,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
