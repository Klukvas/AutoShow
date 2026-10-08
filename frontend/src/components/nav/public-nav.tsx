'use client';

import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useFavorites } from '@/lib/favorites';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import type { Branding } from '@/lib/api/types';

interface PublicNavProps {
  branding: Branding | null;
}

const LINKS: Array<{ href: string; key: 'catalog' | 'about' | 'contacts' }> = [
  { href: '/cars', key: 'catalog' },
  { href: '/about', key: 'about' },
  { href: '/contacts', key: 'contacts' },
];

function isActiveLink(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Handoff header: 70px sticky surface bar with a hairline bottom border.
 * Logo square + wordmark · nav links (active = 2px accent underline) · theme
 * toggle · language switcher · accent CTA. On mobile: logo + ☾ + burger with
 * a full-screen drawer.
 */
export function PublicNav({ branding }: PublicNavProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close the menu whenever the route changes (link tapped).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open (ref-counted — the gallery
  // lightbox and the filter sheet hold the same lock).
  useEffect(() => {
    if (!menuOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [menuOpen]);

  const displayName = branding?.displayName ?? 'AutoFlow';

  return (
    <header className="sticky top-0 z-40 h-header border-b border-line bg-surface">
      <div className="mx-auto flex h-full items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex items-center gap-10">
          <BrandMark branding={branding} displayName={displayName} />

          {/* Desktop links */}
          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'focus-ring relative flex h-header items-center text-sub font-semibold transition-colors',
                    active ? 'text-ink' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  {t(link.key)}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-lot-gold"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-3 md:flex">
          <FavoritesLink label={t('favorites')} />
          <ThemeToggle />
          <LanguageSwitcher label={t('language')} />
          <Button as="link" href="/contacts#lead" variant="primary" size="sm">
            {t('cta')}
          </Button>
        </div>

        {/* Mobile right cluster */}
        <div className="flex items-center gap-2 md:hidden">
          <FavoritesLink label={t('favorites')} />
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? t('menuClose') : t('menuOpen')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-btn border border-line-input text-ink"
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* Mobile drawer — portaled to <body> so it escapes the header's stacking context. */}
      {mounted &&
        menuOpen &&
        createPortal(
          // Portaled to <body>, i.e. outside the (public) layout's theme wrapper —
          // re-apply the Paper Lot scope or the menu falls back to the admin palette.
          <div className="theme-vitrina-paper fixed inset-0 z-[100] flex flex-col bg-bg px-5 pb-8 pt-4 text-ink md:hidden">
            <div className="flex h-header items-center justify-between">
              <BrandMark branding={branding} displayName={displayName} />
              <button
                type="button"
                aria-label={t('menuClose')}
                onClick={() => setMenuOpen(false)}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-btn border border-line-input text-ink"
              >
                <BurgerIcon open />
              </button>
            </div>
            <nav aria-label="Mobile" className="mt-6 flex flex-col">
              {LINKS.map((link) => {
                const active = isActiveLink(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      // Active row mirrors the desktop marker: its rule turns gold.
                      'focus-ring border-b py-4 font-heading text-title-sm font-bold text-ink hover:text-lot-gold',
                      active ? 'border-lot-gold' : 'border-line',
                    )}
                  >
                    {t(link.key)}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-8 flex items-center gap-3">
              <Button
                as="link"
                href="/contacts#lead"
                variant="primary"
                size="lg"
                className="flex-1"
              >
                {t('cta')}
              </Button>
              <LanguageSwitcher label={t('language')} />
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}

/** Heart with a count bubble → /favorites. Hidden until hydration (count is
 *  client-only) and while empty — an always-on zero would just be noise. */
function FavoritesLink({ label }: { label: string }) {
  const { slugs, ready } = useFavorites();
  if (!ready || slugs.length === 0) return null;
  return (
    <Link
      href="/favorites"
      aria-label={`${label} (${slugs.length})`}
      className="focus-ring relative flex h-[38px] w-[38px] items-center justify-center rounded-btn border border-line-input bg-surface text-ink transition-colors hover:border-line-hover"
    >
      <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        aria-hidden
        className="h-[18px] w-[18px] fill-transparent stroke-current"
      >
        <path d="M12 21c-4.8-3.6-8-6.7-8-10.2C4 8 6 6 8.5 6c1.4 0 2.7.7 3.5 1.8C12.8 6.7 14.1 6 15.5 6 18 6 20 8 20 10.8c0 3.5-3.2 6.6-8 10.2z" />
      </svg>
      <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold text-on-accent">
        {slugs.length}
      </span>
    </Link>
  );
}

function BrandMark({ branding, displayName }: { branding: Branding | null; displayName: string }) {
  return (
    <Link href="/" className="focus-ring inline-flex items-center gap-2.5" aria-label={displayName}>
      {branding?.logoUrl ? (
        <Image
          src={branding.logoUrl}
          alt={displayName}
          width={132}
          height={30}
          priority
          className="h-[30px] w-auto object-contain"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="flex h-[30px] w-[30px] items-center justify-center rounded-btn bg-ink font-heading text-[15px] font-extrabold text-bg"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="font-heading text-[18px] font-extrabold tracking-tight text-ink">
            {displayName}
          </span>
        </>
      )}
    </Link>
  );
}

/**
 * Language disclosure — the site currently ships one locale (UA), so this is
 * an architecture-ready stub: the menu lists the active locale and closes on
 * outside click / Escape. Adding locales only means extending the list.
 */
function LanguageSwitcher({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex h-[38px] items-center gap-1 rounded-btn border border-line-input bg-surface px-3 text-sub font-semibold text-ink transition-colors hover:border-line-hover"
      >
        UA
        <span aria-hidden className="text-[9px] text-ink-3">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] min-w-[160px] rounded-input border border-line bg-surface p-1 shadow-panel"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked
            onClick={() => setOpen(false)}
            className="focus-ring flex w-full items-center justify-between rounded-btn px-3 py-2 text-sub font-medium text-ink hover:bg-bg"
          >
            Українська
            <span aria-hidden className="text-accent">
              ✓
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function BurgerIcon({ open }: { open?: boolean }) {
  return (
    <span aria-hidden className="relative block h-3.5 w-5">
      <span
        className={cn(
          'absolute left-0 h-[1.5px] w-5 rounded-full bg-current transition-transform',
          open ? 'top-1/2 rotate-45' : 'top-0',
        )}
      />
      <span
        className={cn(
          'absolute left-0 top-1/2 h-[1.5px] w-5 rounded-full bg-current transition-opacity',
          open ? 'opacity-0' : 'opacity-100',
        )}
      />
      <span
        className={cn(
          'absolute left-0 h-[1.5px] w-5 rounded-full bg-current transition-transform',
          open ? 'top-1/2 -rotate-45' : 'bottom-0',
        )}
      />
    </span>
  );
}
