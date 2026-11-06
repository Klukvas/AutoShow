'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getGoogleAnalytics, getMeasurementId } from '@/lib/analytics/google';

const measurementId = getMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!measurementId) return;
    const analytics = getGoogleAnalytics(window, measurementId);
    analytics.pageView(pathname, document.title);
    return () => analytics.disable();
  }, [pathname]);

  if (!measurementId || /^\/admin(?:\/|$)/.test(pathname)) return null;
  return (
    <Script
      id="google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
