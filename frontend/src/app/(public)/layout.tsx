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
    // theme-vitrina-paper: warm "Paper Lot" re-skin scoped to the public
    // storefront only — overrides the semantic tokens for this subtree while
    // the admin area keeps the base palette. bg-bg/text-ink here resolve to
    // the warm values defined on this wrapper.
    <div className="theme-vitrina-paper bg-bg text-ink">
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
    </div>
  );
}
