import { redirect } from 'next/navigation';
import { adminApi, type AdminRole } from '@/lib/api/admin';
import { readSession } from '@/lib/auth/session';
import { readServerToken } from '@/lib/auth/refresh';
import { getSiteBranding } from '@/lib/branding/resolve';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ToastProvider } from '@/components/admin/ui/toast';
import { AdminSidebar, type AdminNavLink } from '@/components/admin/admin-sidebar';
import { AdminQueryProvider } from '@/components/admin/query-provider';
import { LeadLiveNotifier } from '@/components/admin/leads/lead-live-notifier';
import { BillingBanner } from '@/components/admin/billing/billing-banner';
import { BillingLockedNotice } from '@/components/admin/billing/billing-locked-notice';
import { readBillingStatus } from '@/lib/admin/billing-server';

/**
 * Admin shell (handoff 1b): dark 236px sidebar + light workspace. Both themes
 * are first-class — the subtree follows the global data-theme attribute (the
 * sidebar stays dark by design in either).
 *
 * Role gate: editors only ever SEE Об'яви/Заявки (hidden, not disabled);
 * everything else (dashboard, reviews, packages, team, branding, audit) is admin-only
 * and additionally redirects on the page level.
 *
 * Billing gate: while the hosting subscription is blocked an editor gets only
 * an unpaid notice in place of any page; an admin gets a nav-less shell and
 * every page redirects to /admin/billing (requireServerToken). The backend
 * answers 402 for anything else anyway.
 *
 * Lives in the `(dashboard)` route group so `/admin/login` renders outside it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Session-presence gate only — pure read, no cookie writes in render.
  const session = await readSession();
  if (!session) redirect('/admin/login');

  // New-leads badge: best-effort, read-only token (skip when stale — the
  // badge is not worth a refresh round-trip on every render).
  let newLeads = 0;
  const auth = await readServerToken();
  const user = auth?.session.user ?? session.user;
  const isAdmin = user.role === 'admin';

  const branding = await getSiteBranding().catch(() => null);
  const brandName = branding?.displayName ?? 'AutoFlow';

  const billing = auth ? await readBillingStatus(auth.accessToken) : null;
  if (auth && billing?.blocked) {
    if (!isAdmin) return <BillingLockedNotice email={user.email} />;
    // No navigation; every page but /admin/billing redirects there via
    // requireServerToken, so the billing page renders the panel itself.
    return (
      <AdminChrome links={[]} email={user.email} role={user.role} brandName={brandName}>
        {children}
      </AdminChrome>
    );
  }

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

  const links: AdminNavLink[] = [
    ...(isAdmin ? ([{ href: '/admin', key: 'dashboard' }] as AdminNavLink[]) : []),
    { href: '/admin/listings', key: 'listings' },
    { href: '/admin/leads', key: 'leads', badge: newLeads },
    { href: '/admin/catalog', key: 'catalog' },
    ...(isAdmin
      ? ([
          { href: '/admin/reviews', key: 'reviews' },
          { href: '/admin/packages', key: 'packages' },
          { href: '/admin/collections', key: 'collections' },
          { href: '/admin/tags', key: 'tags' },
          { href: '/admin/team', key: 'team' },
          { href: '/admin/branding', key: 'branding' },
          { href: '/admin/audit', key: 'audit' },
          ...(billing?.enabled ? ([{ href: '/admin/billing', key: 'billing' }] as const) : []),
        ] as AdminNavLink[])
      : []),
  ];

  return (
    <AdminChrome links={links} email={user.email} role={user.role} brandName={brandName}>
      {/* Toasts a lead that arrives while the admin is already in here. */}
      <LeadLiveNotifier initialNewCount={newLeads} />
      {isAdmin && <BillingBanner status={billing} />}
      {children}
    </AdminChrome>
  );
}

function AdminChrome({
  links,
  email,
  role,
  brandName,
  children,
}: {
  links: AdminNavLink[];
  email: string;
  role: AdminRole;
  brandName: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AdminQueryProvider>
        <ToastProvider>
          <div className="cinematic-admin min-h-dvh bg-bg text-ink md:flex">
            <AdminSidebar links={links} email={email} role={role} brandName={brandName} />
            <main className="min-w-0 flex-1 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 md:px-[30px] md:py-[26px]">
              {children}
            </main>
          </div>
        </ToastProvider>
      </AdminQueryProvider>
    </ThemeProvider>
  );
}
