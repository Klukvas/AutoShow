export function getMeasurementId(value: string | undefined): string | null {
  return value && /^G-[A-Z0-9]{10}$/.test(value) ? value : null;
}

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: Gtag;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export type AnalyticsBrowser = {
  location: { origin: string; pathname: string };
  dataLayer?: IArguments[];
  gtag?: Gtag;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

type Tracker = {
  pageView: (pathname: string, title: string) => void;
  disable: () => void;
};

const trackers = new WeakMap<AnalyticsBrowser, Tracker>();

/** One configuration per document, including public → admin → public visits. */
export function getGoogleAnalytics(browser: AnalyticsBrowser, measurementId: string): Tracker {
  const existing = trackers.get(browser);
  if (existing) return existing;

  let configured = false;
  let previousLocation = '';
  let lastLocation = '';
  browser.dataLayer ??= [];
  browser.gtag ??= function () {
    browser.dataLayer?.push(arguments);
  };
  const gtag = browser.gtag;
  const disableKey = `ga-disable-${measurementId}` as const;

  const tracker: Tracker = {
    pageView(pathname, title) {
      // Check the live URL too: a deferred effect must never record an admin route.
      if (pathname !== browser.location.pathname || /^\/admin(?:\/|$)/.test(pathname)) {
        browser[disableKey] = true;
        return;
      }
      browser[disableKey] = false;
      const pageLocation = `${browser.location.origin}${pathname}`;
      if (pageLocation === lastLocation) return;
      const page = {
        page_location: pageLocation,
        page_referrer: previousLocation,
        page_title: title,
      };
      if (!configured) {
        gtag('js', new Date());
        gtag('config', measurementId, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          ...page,
        });
        configured = true;
      }
      // Keep automatic lifecycle events on the same query/hash-free public URL.
      gtag('set', page);
      gtag('event', 'page_view', { ...page, send_to: measurementId });
      previousLocation = pageLocation;
      lastLocation = pageLocation;
    },
    disable() {
      // Loaded tags outlive the public layout; stop their automatic events too.
      browser[disableKey] = true;
      // Strict Mode immediately resumes the same view; a real layout exit does
      // not. A later return to that public page must count as a new visit.
      queueMicrotask(() => {
        if (browser[disableKey]) lastLocation = '';
      });
    },
  };
  trackers.set(browser, tracker);
  return tracker;
}
