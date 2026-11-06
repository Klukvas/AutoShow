import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getGoogleAnalytics, getMeasurementId, type AnalyticsBrowser } from './google';

const measurementId = 'G-123456ABCD';

function fixture() {
  const browser: AnalyticsBrowser = {
    location: { origin: 'https://dealer.example', pathname: '/' },
  };
  const tracker = getGoogleAnalytics(browser, measurementId);
  const commands = () => browser.dataLayer?.map((entry) => Array.from(entry)) ?? [];
  const views = () => commands().filter((entry) => entry[0] === 'event');
  return { browser, tracker, commands, views };
}

describe('optional GA4 measurement ID', () => {
  it.each([undefined, '', 'G-short', 'G-123456abcd', 'G-123456ABCD ', 'G-123456ABCD<script>'])(
    'disables absent/malformed ID %s', (value) => {
      expect(getMeasurementId(value)).toBeNull();
    },
  );
  it('accepts a GA4 web stream ID', () => {
    expect(getMeasurementId(measurementId)).toBe(measurementId);
  });
});

describe('public GA4 views', () => {
  it('configures once, suppresses automatic views and records public navigation', () => {
    const { browser, tracker, commands, views } = fixture();
    tracker.pageView('/', 'Home');
    tracker.disable();
    tracker.pageView('/', 'Home'); // React Strict Mode effect replay.
    browser.location = { ...browser.location, pathname: '/contacts' };
    tracker.pageView('/contacts', 'Contacts');
    expect(commands().filter((entry) => entry[0] === 'config')).toEqual([
      ['config', measurementId, expect.objectContaining({
        send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })],
    ]);
    expect(views()).toEqual([
      ['event', 'page_view', {
        page_location: 'https://dealer.example/', page_referrer: '',
        page_title: 'Home', send_to: measurementId,
      }],
      ['event', 'page_view', {
        page_location: 'https://dealer.example/contacts',
        page_referrer: 'https://dealer.example/', page_title: 'Contacts', send_to: measurementId,
      }],
    ]);
  });

  it('opts out on exit, blocks stale/admin effects and resumes without reconfiguring', async () => {
    const { browser, tracker, commands, views } = fixture();
    tracker.pageView('/', 'Home');
    tracker.disable();
    await Promise.resolve();
    expect(browser[`ga-disable-${measurementId}`]).toBe(true);
    browser.location = { ...browser.location, pathname: '/admin/login' };
    tracker.pageView('/', 'Stale home');
    tracker.pageView('/admin/login', 'Admin');
    expect(browser[`ga-disable-${measurementId}`]).toBe(true);
    expect(views()).toHaveLength(1);
    browser.location = { ...browser.location, pathname: '/' };
    const resumed = getGoogleAnalytics(browser, measurementId);
    resumed.pageView('/', 'Home');
    expect(browser[`ga-disable-${measurementId}`]).toBe(false);
    expect(views()).toHaveLength(2);
    expect(commands().filter((entry) => entry[0] === 'config')).toHaveLength(1);
  });

  it('does not forward query, fragment or document referrer data', () => {
    const { browser, tracker, views } = fixture();
    browser.location = {
      ...browser.location, pathname: '/contacts',
      ...{ search: '?email=private@example.com', hash: '#phone' },
    };
    tracker.pageView('/contacts', 'Contacts');
    expect(JSON.stringify(views())).not.toMatch(/private|email|phone|\?|#/);
  });
});

describe('GA4 production CSP', () => {
  it.each(['', 'invalid', measurementId])('allows Google only for a valid ID (%s)', (id) => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e',
      `const {default:c}=await import('./next.config.mjs');process.stdout.write(JSON.stringify(await c.headers()))`,
    ], {
      cwd: process.cwd(), encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: id },
    });
    const headers = JSON.parse(result) as { headers: { key: string; value: string }[] }[];
    const csp = headers[0].headers.find((entry) => entry.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp.includes('https://www.googletagmanager.com')).toBe(id === measurementId);
    expect(csp.includes('https://*.google-analytics.com')).toBe(id === measurementId);
    expect(csp.includes('https://*.google.com')).toBe(id === measurementId);
    expect(csp).not.toContain('doubleclick');
  });
});
