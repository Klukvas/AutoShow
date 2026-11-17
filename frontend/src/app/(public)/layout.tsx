import { getInstallation } from '@/lib/installation/server';
import { StorefrontPresentation } from '@/components/installation/storefront-presentation';
import { Shell } from '@theme/shell';
import '@theme/tokens.css';
import '@/styles/installations.css';
import { LenisProvider } from '@/components/motion/lenis-provider';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { FavoritesProvider } from '@/lib/favorites';
import { CompareProvider } from '@/lib/compare';
import { getSiteBranding } from '@/lib/branding/resolve';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [branding, installation] = await Promise.all([getSiteBranding(), getInstallation()]);
  // Providers render no DOM, so wrapping the theme's frame (instead of sitting
  // inside it) keeps the markup and lets a theme replace the frame without
  // being able to drop favorites, compare or scroll behaviour.
  return (
    <StorefrontPresentation installation={installation}>
      <GoogleAnalytics />
      <ThemeProvider>
        <LenisProvider>
          <FavoritesProvider>
            <CompareProvider>
              <Shell branding={branding}>{children}</Shell>
            </CompareProvider>
          </FavoritesProvider>
        </LenisProvider>
      </ThemeProvider>
    </StorefrontPresentation>
  );
}
