import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { readSession } from '@/lib/auth/session';
import { readServerToken } from '@/lib/auth/refresh';
import { getSiteBranding } from '@/lib/branding/resolve';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { AdminSidebar, type AdminNavLink } from '@/components/admin/admin-sidebar';

/**
 * Admin shell (handoff 1b): dark 236px sidebar + light workspace. Both themes
 * are first-class — the subtree follows the global data-theme attribute (the
 * sidebar stays dark by design in either).
 *
 * Role gate: editors only ever SEE Об'яви/Заявки (hidden, not disabled);
 * admin-only routes additionally redirect on the page level.
 *
 * Lives in the `(dashboard)` route group so `/admin/login` renders outside it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Session-presence gate only — pure read, no cookie writes in render.
  const session = await readSession();
  if (!session) redirect('/admin/login');

  const isAdmin = session.user.role === 'admin';

  // New-leads badge: best-effort, read-only token (skip when stale — the
  // badge is not worth a refresh round-trip on every render).
  let newLeads = 0;
  const auth = await readServerToken();
  if (auth) {
    try {
      const page = await adminApi.listLeads(
        { status: 'new', limit: '1' },
        { accessToken: auth.accessToken },
      );
      newLeads = page.total ?? page.items.length;
    } catch {
      // Badge is decorative — a failing leads call must not break the shell.
    }
  }

  const branding = await getSiteBranding().catch(() => null);
  const brandName = branding?.displayName ?? 'AutoFlow';

  const links: AdminNavLink[] = [
    { href: '/admin', key: 'dashboard' },
    { href: '/admin/listings', key: 'listings' },
    { href: '/admin/leads', key: 'leads', badge: newLeads },
    { href: '/admin/reviews', key: 'reviews' },
    ...(isAdmin
      ? ([
          { href: '/admin/team', key: 'team' },
          { href: '/admin/branding', key: 'branding' },
          { href: '/admin/audit', key: 'audit' },
        ] as AdminNavLink[])
      : []),
  ];

  return (
    <ThemeProvider>
      <div className="min-h-dvh bg-surface-2 text-ink md:flex">
        <AdminSidebar
          links={links}
          email={session.user.email}
          role={session.user.role}
          brandName={brandName}
        />
        <main className="min-w-0 flex-1 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 md:px-[30px] md:py-[26px]">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
