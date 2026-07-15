'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { logoutAction } from '@/lib/auth/actions';
import { useTheme } from '@/components/theme/theme-provider';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { useFocusTrap } from '@/lib/use-focus-trap';
import type { AdminRole } from '@/lib/api/admin';

export interface AdminNavLink {
  href: string;
  key: 'dashboard' | 'listings' | 'leads' | 'reviews' | 'team' | 'branding' | 'audit';
  badge?: number;
}

interface AdminSidebarProps {
  links: AdminNavLink[];
  email: string;
  role: AdminRole;
  brandName: string;
}

const ICONS: Record<AdminNavLink['key'], React.ReactNode> = {
  dashboard: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 13.5V8.6l2.8-2.3 2.9 2 3-4.3 3.3 2.6v6.9" />
      <path d="M1.5 13.5h13" />
    </svg>
  ),
  listings: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1.5" y="1.5" width="5.4" height="5.4" rx="1" />
      <rect x="9.1" y="1.5" width="5.4" height="5.4" rx="1" />
      <rect x="1.5" y="9.1" width="5.4" height="5.4" rx="1" />
      <rect x="9.1" y="9.1" width="5.4" height="5.4" rx="1" />
    </svg>
  ),
  leads: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="m2 4 6 5 6-5" />
    </svg>
  ),
  reviews: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8 1.8l1.9 3.8 4.2.6-3 3 .7 4.2L8 11.4l-3.8 2 .7-4.2-3-3 4.2-.6L8 1.8Z" />
    </svg>
  ),
  team: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="5.6" cy="5.4" r="2.4" />
      <path d="M1.5 13.5c.5-2.4 2-3.6 4.1-3.6s3.6 1.2 4.1 3.6" />
      <circle cx="11.6" cy="5.8" r="1.9" />
      <path d="M11 9.9c1.9 0 3.1 1 3.5 3" />
    </svg>
  ),
  branding: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="m10.8 2.3 2.9 2.9L5.4 13.5l-3.4.6.5-3.5 8.3-8.3Z" />
      <path d="m9.3 3.8 2.9 2.9" />
    </svg>
  ),
  audit: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 3.5h12M2 8h12M2 12.5h8" />
    </svg>
  ),
};

/**
 * Admin shell chrome (handoff 1b/1c): 236px dark sidebar on desktop — logo,
 * icon nav with the 3px accent bar on the active item and a leads counter
 * badge, then the user block with theme/logout at the bottom. On mobile it
 * collapses into a top bar (burger + section title + primary action slot)
 * with an off-canvas drawer.
 */
export function AdminSidebar({ links, email, role, brandName }: AdminSidebarProps) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { toggle } = useTheme();
  const drawerRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [open]);

  // '/admin' (dashboard) is a prefix of every admin route — exact-match it,
  // otherwise the dashboard item would light up on every page.
  const matches = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  const active = links.find((l) => matches(l.href));
  const initial = (email[0] ?? 'a').toUpperCase();

  const nav = (
    <nav aria-label={t('nav.label')} className="flex flex-col gap-[3px]">
      {links.map((l) => {
        const isActive = matches(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'focus-ring relative flex min-h-[44px] items-center gap-[11px] rounded-[9px] px-[13px] py-2.5 text-[13.5px] font-semibold transition-none',
              isActive
                ? 'bg-sb-active text-sb-ink before:absolute before:-left-[13px] before:bottom-2 before:top-2 before:w-[3px] before:rounded-[3px] before:bg-accent'
                : 'text-sb-muted hover:bg-sb-active hover:text-sb-ink-2',
            )}
          >
            <span aria-hidden className="w-[18px] flex-none">
              {ICONS[l.key]}
            </span>
            <span>{t(`nav.${l.key}`)}</span>
            {l.badge ? (
              <span
                aria-label={t('nav.newLeads', { count: l.badge })}
                className="ml-auto rounded-full bg-accent px-[7px] py-[1px] text-[10px] font-bold text-on-accent"
              >
                {l.badge > 99 ? '99+' : l.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="mt-auto border-t border-sb-line pt-3.5">
      <div className="flex items-center gap-2.5 px-2 pb-3">
        <span
          aria-hidden
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-[13px] font-bold text-on-accent"
        >
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-sb-ink">{email}</span>
          <span className="block text-[11px] font-medium text-sb-faint">
            {t(`nav.role.${role}`)}
          </span>
        </span>
      </div>
      <div className="flex gap-[7px]">
        <button
          type="button"
          onClick={toggle}
          className="focus-ring inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-sb-input-line bg-transparent text-[12px] font-semibold text-sb-ink-2 hover:text-sb-ink"
        >
          <span aria-hidden>☾</span> {t('nav.theme')}
        </button>
        <form action={logoutAction} className="flex-1">
          <button
            type="submit"
            className="focus-ring inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] border border-sb-input-line bg-transparent text-[12px] font-semibold text-sb-ink-2 hover:text-sb-ink"
          >
            <span aria-hidden>↪</span> {t('nav.logout')}
          </button>
        </form>
      </div>
    </div>
  );

  const logo = (
    <Link href="/admin/listings" className="focus-ring flex items-center gap-[9px] rounded-[8px]">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent font-heading text-[14px] font-extrabold text-on-accent"
      >
        {brandName[0]?.toUpperCase() ?? 'A'}
      </span>
      <span className="font-heading text-[16px] font-extrabold tracking-tight text-sb-ink">
        {brandName}
      </span>
    </Link>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[236px] flex-none flex-col bg-sb-bg px-[13px] py-5 md:flex">
        <div className="px-2 pb-5">{logo}</div>
        {nav}
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
        <button
          type="button"
          aria-label={open ? t('nav.menuClose') : t('nav.menuOpen')}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[8px] border border-line-input text-ink-2"
        >
          <svg
            viewBox="0 0 16 12"
            className="h-3 w-4"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            {open ? <path d="M2 1l12 10M14 1L2 11" /> : <path d="M1 1h14M1 6h14M1 11h14" />}
          </svg>
        </button>
        <h1 className="min-w-0 truncate font-heading text-[17px] font-extrabold tracking-tight text-ink">
          {active ? t(`nav.${active.key}`) : brandName}
        </h1>
        <div className="ml-auto" id="admin-topbar-action" />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div ref={drawerRef} className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t('nav.menuClose')}
            onClick={() => setOpen(false)}
            tabIndex={-1}
            className="absolute inset-0 bg-[rgba(20,22,27,0.55)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.label')}
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sb-bg px-[13px] py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="px-2 pb-5">{logo}</div>
            {nav}
            {userBlock}
          </div>
        </div>
      )}
    </>
  );
}
