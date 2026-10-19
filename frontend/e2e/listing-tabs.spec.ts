import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

let server: Server;
let origin = '';

test.beforeAll(async () => {
  const bundled = await build({
    entryPoints: [path.join(__dirname, 'listing-tabs.fixture.tsx')],
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

const LISTING = '/api/admin/listings/11111111-1111-4111-8111-111111111111';

async function open(page: Page, query = '') {
  const patches: Array<Record<string, unknown>> = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/admin/api/token')
      return route.fulfill({ json: { accessToken: 'local-fixture-token' } });
    if (url.pathname === '/api/admin/catalog/makes')
      return route.fulfill({
        json: [{ id: 'make-1', slug: 'make-1', nameUk: 'BMW', nameEn: null, modelCount: 1 }],
      });
    if (url.pathname === '/api/admin/catalog/models')
      return route.fulfill({
        json: [{ id: 'model-1', slug: 'model-1', nameUk: 'X5', nameEn: null, makeId: 'make-1' }],
      });
    if (url.pathname === `${LISTING}/ai-description`)
      return route.fulfill({ json: { permitted: false, reason: 'Немає доступу.' } });
    if (url.pathname === LISTING && method === 'PATCH') {
      patches.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { id: LISTING.split('/').pop(), version: 4 } });
    }
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: 503, json: { message: 'Fixture denies unrelated API' } });
    if (url.origin !== origin) return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.goto(`${origin}/${query}`);
  return patches;
}

// The error mark adds «(є помилки)» to the accessible name, so match the start.
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });

test('tabs switch in place, keep unsaved input and mirror the tab in the URL', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1100 });
  await open(page);
  await expect(page.getByRole('tab')).toHaveText([
    'Основне',
    'Комплектація',
    'Опис',
    'Медіа',
    'Telegram',
  ]);
  await expect(tab(page, 'Основне')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Рік')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Заголовок/ })).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('listing-tabs-main.png'), fullPage: true });

  await page.getByLabel('Рік').fill('2020');
  await tab(page, 'Опис').click();
  await expect(page).toHaveURL(/\?tab=description$/);
  await expect(page.getByLabel('Рік')).toBeHidden();
  await page.getByRole('textbox', { name: /^Заголовок/ }).fill('BMW X5 2020 повний привід');
  await page.screenshot({ path: test.info().outputPath('listing-tabs-description.png') });

  // Keyboard: arrows move along the tablist and select.
  await tab(page, 'Опис').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Медіа')).toBeFocused();
  await expect(page.getByText('Медіа-менеджер')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(tab(page, 'Основне')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(new RegExp(`^${origin}/$`));
  await expect(page.getByLabel('Рік')).toHaveValue('2020');
});

test('one save sends the fields of every tab', async ({ page }) => {
  const patches = await open(page);
  await page.getByLabel('Рік').fill('2020');
  await tab(page, 'Комплектація').click();
  await page.getByText('Топ', { exact: true }).click();
  await tab(page, 'Опис').click();
  await page.getByLabel('SEO-заголовок').fill('BMW X5 у Києві');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toMatchObject({
    year: 2020,
    optionIds: ['opt-1'],
    tagIds: ['tag-1'],
    metaTitle: 'BMW X5 у Києві',
    title: 'BMW X5 2021 дизель',
    version: 3,
  });
});

test('a validation error opens its tab, marks it and focuses the field', async ({ page }) => {
  const patches = await open(page);
  await tab(page, 'Опис').click();
  await page.getByRole('textbox', { name: /^Опис/ }).fill('коротко');
  await tab(page, 'Комплектація').click();
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(tab(page, 'Опис')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Опис')).toContainText('(є помилки)');
  await expect(tab(page, 'Основне')).not.toContainText('(є помилки)');
  await expect(page.getByRole('textbox', { name: /^Опис/ })).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('listing-tabs-error.png') });
  expect(patches).toHaveLength(0);
});

test('?tab= opens that tab on load', async ({ page }) => {
  await open(page, '?tab=telegram');
  await expect(tab(page, 'Telegram')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Публікації в Telegram')).toBeVisible();
});

test('a new listing keeps media and Telegram locked until the first save', async ({ page }) => {
  await open(page, '?mode=new&tab=media');
  await expect(tab(page, 'Основне')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Медіа')).toBeDisabled();
  await expect(tab(page, 'Telegram')).toBeDisabled();
  await expect(page.getByText(/стануть доступні після першого збереження/)).toBeVisible();
});

test('mobile: the tab strip scrolls inside itself, not the page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await tab(page, 'Telegram').scrollIntoViewIfNeeded();
  await tab(page, 'Telegram').click();
  await expect(page.getByText('Публікації в Telegram')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('listing-tabs-mobile.png') });
});
