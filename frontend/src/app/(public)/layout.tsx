import { PublicFooter } from '@/components/nav/public-footer';
import { PublicNav } from '@/components/nav/public-nav';
import { LenisProvider } from '@/components/motion/lenis-provider';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { getSiteBranding } from '@/lib/branding/resolve';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await getSiteBranding();
  return (
    <ThemeProvider>
      <LenisProvider>
        <PublicNav branding={branding} />
        <main className="min-h-dvh">{children}</main>
        <PublicFooter branding={branding} />
      </LenisProvider>
    </ThemeProvider>
  );
}
