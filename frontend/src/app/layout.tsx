import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { fontDisplay, fontSans } from '@/lib/fonts';
import { getSiteBranding } from '@/lib/branding/resolve';
import { brandingThemeCss } from '@/lib/branding/theme';
import { ThemeScript } from '@/components/theme/theme-script';
import '@/styles/globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getSiteBranding();
  const display = branding?.displayName ?? 'AutoFlow';
  const seo = branding?.seoDefaults;
  return {
    title: {
      default: display,
      template: seo?.titleTemplate ?? `%s — ${display}`,
    },
    description: seo?.description ?? 'Кураторська вітрина авто',
    openGraph: {
      siteName: display,
      type: 'website',
      images: seo?.ogImage ? [{ url: seo.ogImage }] : undefined,
    },
    icons: branding?.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve locale alongside branding/messages — propagated to both <html lang>
  // and NextIntlClientProvider so client components never fall back to the
  // server-side default during hydration.
  const [branding, messages, locale] = await Promise.all([
    getSiteBranding(),
    getMessages(),
    getLocale(),
  ]);
  const themeCss = brandingThemeCss(branding);

  return (
    // suppressHydrationWarning: the inline ThemeScript sets data-theme on
    // <html> before hydration — expected server/client attribute difference.
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Brand accent (both themes) + stored/system theme — BEFORE first paint, no FOUC. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <ThemeScript />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) inject
          data-* attributes into <body> before hydration — not our markup. */}
      <body className="bg-bg text-ink antialiased" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
