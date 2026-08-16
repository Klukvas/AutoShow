import { PublicFooter } from '@/components/nav/public-footer';
import { PublicNav } from '@/components/nav/public-nav';
import { CompareBar } from '@/components/listing/compare-bar';
import { LenisProvider } from '@/components/motion/lenis-provider';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { FavoritesProvider } from '@/lib/favorites';
import { CompareProvider } from '@/lib/compare';
import { getSiteBranding } from '@/lib/branding/resolve';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await getSiteBranding();
  return (
    <ThemeProvider>
      <LenisProvider>
        <FavoritesProvider>
          <CompareProvider>
            <PublicNav branding={branding} />
            <main className="min-h-dvh">{children}</main>
            <CompareBar />
            <PublicFooter branding={branding} />
          </CompareProvider>
        </FavoritesProvider>
      </LenisProvider>
    </ThemeProvider>
  );
}
