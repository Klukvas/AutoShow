import { HomepageShell } from '@/components/home/homepage-shell';
import { CompareBar } from '@/components/listing/compare-bar';
import { PublicFooter } from '@/components/nav/public-footer';
import { PublicNav } from '@/components/nav/public-nav';
import type { ShellProps } from '../contract';

/** Existing storefront frame: header, page content, compare tray and footer. */
export function Shell({ branding, children }: ShellProps) {
  return (
    <HomepageShell>
      <PublicNav branding={branding} />
      <main className="min-h-dvh">{children}</main>
      <CompareBar />
      <PublicFooter branding={branding} />
    </HomepageShell>
  );
}
