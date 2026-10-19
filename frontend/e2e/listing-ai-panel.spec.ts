import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ListingAiDraft, ListingAiField, ListingAiFlag } from '../src/lib/admin/listing-ai';

let server: Server;
let origin = '';

test.beforeAll(async () => {
  const bundled = await build({
    entryPoints: [path.join(__dirname, 'listing-ai-panel.fixture.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    tsconfig: path.join(__dirname, '../tsconfig.json'),
  });
  const cssDir = path.join(__dirname, '../.next/static/css');
  const cssFiles = (await readdir(cssDir)).filter((name) => name.endsWith('.css'));
  const css = (
    await Promise.all(cssFiles.map((name) => readFile(path.join(cssDir, name), 'utf8')))
  ).join('\n');
  server = createServer((req, res) => {
    if (req.url === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundled.outputFiles[0].text);
    } else if (req.url === '/style.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(css);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="uk" data-theme="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-bg text-ink"><div id="root"></div><script src="/fixture.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no local fixture address');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

const result = {
  description: 'BMW X5 2021 року. Повний привід, автомат. Запишіться на огляд.',
  metaTitle: 'BMW X5 2021, дизель',
  metaDescription: 'BMW X5 2021 року з повним приводом. Перегляньте оголошення.',
};

type State = {
  permitted: boolean;
  available: boolean;
  reason: string | null;
  drafts: ListingAiDraft[];
  polls: number;
  creates: Array<{ requestId: string; preset: string }>;
  accepts: Array<{ fields: ListingAiField[]; confirmFlags: boolean }>;
  flags: ListingAiFlag[];
  stale: boolean;
};

async function fixture(page: Page, init: Partial<State> = {}) {
  const state: State = {
    permitted: true,
    available: true,
    reason: null,
    drafts: [],
    polls: 0,
    creates: [],
    accepts: [],
    flags: [],
    stale: false,
    ...init,
  };
  const accepted = () => {
    const owner = (field: ListingAiField) =>
      state.drafts.find((d) => d.acceptedFields?.includes(field)) ?? null;
    return {
      description: owner('description') && { ...owner('description'), isStale: state.stale },
      metaTitle: owner('metaTitle'),
      metaDescription: owner('metaDescription'),
    };
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/admin/api/token')
      return route.fulfill({ json: { accessToken: 'local-fixture-token' } });
    const base = '/api/admin/listings/11111111-1111-4111-8111-111111111111/ai-description';
    if (url.pathname === base && method === 'GET') {
      if (!state.permitted)
        return route.fulfill({ json: { permitted: false, reason: 'Немає доступу.' } });
      return route.fulfill({
        json: {
          permitted: true,
          available: state.available,
          reason: state.reason,
          drafts: state.drafts.map((d) => ({ ...d, isStale: false })),
          accepted: accepted(),
        },
      });
    }
    if (url.pathname === base && method === 'POST') {
      const body = route.request().postDataJSON() as { requestId: string; preset: 'standard' };
      state.creates.push(body);
      const draft: ListingAiDraft = {
        id: `d${state.drafts.length}`,
        preset: body.preset,
        status: 'queued',
        failureReason: null,
        createdAt: new Date().toISOString(),
        result: null,
        flags: [],
        acceptedAt: null,
        acceptedFields: null,
        isStale: null,
      };
      state.drafts.unshift(draft);
      return route.fulfill({ status: 202, json: draft });
    }
    const one = url.pathname.match(new RegExp(`^${base}/(d\\d+)$`));
    if (one) {
      const draft = state.drafts.find((d) => d.id === one[1]);
      if (!draft) return route.fulfill({ status: 404, json: { message: 'nope' } });
      // The second poll finds the draft finished.
      state.polls += 1;
      if (state.polls >= 2 && draft.status === 'queued')
        Object.assign(draft, { status: 'ready', result, flags: state.flags });
      return route.fulfill({ json: { ...draft, isStale: null } });
    }
    const acc = url.pathname.match(new RegExp(`^${base}/(d\\d+)/accept$`));
    if (acc) {
      const body = route.request().postDataJSON() as {
        fields: ListingAiField[];
        confirmFlags: boolean;
      };
      state.accepts.push(body);
      const draft = state.drafts.find((d) => d.id === acc[1]);
      if (!draft?.result) return route.fulfill({ status: 400, json: { message: 'not ready' } });
      draft.acceptedFields = [...new Set([...(draft.acceptedFields ?? []), ...body.fields])];
      draft.acceptedAt = new Date().toISOString();
      const taken = Object.fromEntries(body.fields.map((f) => [f, draft.result?.[f]]));
      return route.fulfill({ json: taken });
    }
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: 503, json: { message: 'Fixture denies unrelated API' } });
    if (url.origin !== origin) return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.goto(origin);
  return state;
}

const panel = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Опис з ШІ' }) });

test('generates a draft, polls it to ready, compares and takes only the description', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 1400 });
  const state = await fixture(page);
  await page.getByRole('button', { name: 'Детально', exact: true }).click();
  await page.getByRole('button', { name: 'Згенерувати опис' }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.creates[0].preset).toBe('detailed');
  await expect(page.getByText('Готово до перегляду · Детально')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Зараз в оголошенні · 17')).toBeVisible();
  await expect(page.getByText(result.description)).toBeVisible();
  await expect(page.getByText(/Перевірка не знайшла розбіжностей/)).toBeVisible();
  await panel(page).screenshot({ path: test.info().outputPath('listing-ai-panel-ready.png') });
  await page.getByRole('button', { name: 'Лише опис', exact: true }).click();
  await expect(page.getByText(/^Текст перенесено у форму/)).toBeVisible();
  expect(state.accepts[0]).toEqual({ fields: ['description'], confirmFlags: false });
  await expect(page.getByLabel('Опис', { exact: true })).toHaveValue(result.description);
  await expect(page.getByLabel('SEO-заголовок', { exact: true })).toHaveValue('');
});

test('a flagged draft can be taken only after the owner confirms the flags', async ({ page }) => {
  const state = await fixture(page, {
    flags: [{ reason: 'mismatch', claim: '40 000 км', sourceField: 'mileageKm', field: null }],
  });
  await page.getByRole('button', { name: 'Згенерувати опис' }).click();
  await expect(page.getByText(/Перевірте перед тим, як брати текст \(1\)/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('«40 000 км» — не збігається з даними оголошення')).toBeVisible();
  const takeAll = page.getByRole('button', { name: 'Взяти все', exact: true });
  await expect(takeAll).toBeDisabled();
  await expect(page.getByText(/^Щоб узяти текст із позначеними твердженнями/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Позначені твердження перевірено/ }).check();
  await takeAll.click();
  await expect(page.getByLabel('SEO-опис', { exact: true })).toHaveValue(result.metaDescription);
  expect(state.accepts[0]).toEqual({
    fields: ['description', 'metaTitle', 'metaDescription'],
    confirmFlags: true,
  });
  await panel(page).screenshot({ path: test.info().outputPath('listing-ai-panel-flags.png') });
});

test('explains why generation is unavailable and hides itself without access', async ({ page }) => {
  await fixture(page, {
    available: false,
    reason: 'Генерації описів закінчилися — докупіть пакет.',
  });
  await expect(page.getByText('Генерації описів закінчилися — докупіть пакет.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Згенерувати опис' })).toBeDisabled();
  await fixture(page, { permitted: false });
  await expect(page.getByRole('heading', { name: 'Опис з ШІ' })).toHaveCount(0);
});

test('warns when an accepted text no longer matches the listing data', async ({ page }) => {
  await fixture(page, {
    stale: true,
    drafts: [
      {
        id: 'd0',
        preset: 'standard',
        status: 'ready',
        failureReason: null,
        createdAt: new Date().toISOString(),
        result,
        flags: [],
        acceptedAt: new Date().toISOString(),
        acceptedFields: ['description'],
        isStale: true,
      },
    ],
  });
  await expect(
    page.getByText(/^Дані авто змінилися після того, як ви взяли текст ШІ \(Опис\)/),
  ).toBeVisible();
});

test('a lost create response is retried with the same request id', async ({ page }) => {
  const state = await fixture(page);
  let dropped = false;
  await page.route('**/ai-description', async (route) => {
    if (route.request().method() === 'POST' && !dropped) {
      dropped = true;
      // The server got it (and may have paid), but the answer never arrives.
      state.creates.push(route.request().postDataJSON());
      return route.abort('failed');
    }
    return route.fallback();
  });
  await page.getByRole('button', { name: 'Згенерувати опис' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Згенерувати опис' }).click();
  await expect.poll(() => state.creates.length).toBe(2);
  expect(state.creates[1].requestId).toBe(state.creates[0].requestId);
});

test('shows the throttler limit in Ukrainian', async ({ page }) => {
  await fixture(page);
  await page.route('**/ai-description', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 429,
          json: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
        })
      : route.fallback(),
  );
  await page.getByRole('button', { name: 'Згенерувати опис' }).click();
  await expect(
    page.getByText('Забагато запитів. Зачекайте хвилину та спробуйте знову.'),
  ).toBeVisible();
});
