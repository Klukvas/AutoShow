import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ListingAiSettings, UpdateListingAiSettings } from '../src/lib/admin/listing-ai';

let server: Server;
let origin = '';

test.beforeAll(async () => {
  const bundled = await build({
    entryPoints: [path.join(__dirname, 'listing-ai-settings.fixture.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    tsconfig: path.join(__dirname, '../tsconfig.json'),
  });
  // Consume the built app styles. Build the frontend before this test.
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

const editor = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'editor@example.test' };

async function fixture(page: Page, initial: Partial<ListingAiSettings> = {}) {
  const settings: ListingAiSettings = {
    enabled: false,
    accessMode: 'all',
    selectedEditorIds: [],
    revision: 0,
    keyUsable: true,
    keyMode: 'own_key',
    available: false,
    brandVoice: { tone: '', bannedWords: [], example: '' },
    ...initial,
  };
  const calls: UpdateListingAiSettings[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    // Only in-memory data: every real API call is answered here.
    if (url.pathname === '/admin/api/token')
      return route.fulfill({ json: { accessToken: 'local-fixture-token' } });
    if (url.pathname === '/api/admin/photo-ai/settings/staff')
      return route.fulfill({ json: [editor] });
    if (url.pathname === '/api/admin/listing-ai/settings') {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as UpdateListingAiSettings;
        calls.push(body);
        if (body.expectedRevision !== settings.revision)
          return route.fulfill({
            status: 409,
            json: { message: 'Налаштування змінив інший користувач. Оновіть сторінку.' },
          });
        settings.enabled = body.enabled ?? settings.enabled;
        settings.accessMode = body.accessMode ?? settings.accessMode;
        settings.selectedEditorIds = body.selectedEditorIds ?? settings.selectedEditorIds;
        settings.brandVoice = {
          tone: body.brandTone ?? settings.brandVoice.tone,
          bannedWords: body.brandBannedWords ?? settings.brandVoice.bannedWords,
          example: body.brandExample ?? settings.brandVoice.example,
        };
        settings.available = settings.enabled && settings.keyUsable;
        settings.revision++;
      }
      return route.fulfill({ json: settings });
    }
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: 503, json: { message: 'Fixture denies unrelated API' } });
    if (url.origin !== origin) return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'Описи авто з ШІ' })).toBeVisible();
  return { settings, calls };
}

test('owner switches descriptions on and saves the brand voice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const { settings, calls } = await fixture(page);
  await expect(page.getByText(/^Генерацію описів вимкнено/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Увімкнути описи з ШІ' }).check();
  await page.getByLabel('Тон і стиль').fill('  Дружньо, без пафосу  ');
  await page.getByLabel('Заборонені слова').fill('ідеальний, як новий,, Ідеальний');
  await expect(page.getByText('Зараз: 2', { exact: false })).toBeVisible();
  await page.getByLabel('Приклад вдалого опису').fill('Надійний седан для міста.');
  await page.getByRole('button', { name: 'Зберегти налаштування описів' }).click();
  await expect(page.getByText('Налаштування описів збережено.')).toBeVisible();
  expect(calls[0]).toEqual({
    expectedRevision: 0,
    enabled: true,
    accessMode: 'all',
    selectedEditorIds: [],
    brandTone: 'Дружньо, без пафосу',
    brandBannedWords: ['ідеальний', 'як новий'],
    brandExample: 'Надійний седан для міста.',
  });
  expect(settings.available).toBe(true);
  await expect(page.getByText('Генерацію описів увімкнено.')).toBeVisible();
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Описи авто з ШІ' }) })
    .screenshot({ path: test.info().outputPath('listing-ai-settings.png') });
});

test('blocks saving a banned-word list the server would reject', async ({ page }) => {
  await fixture(page);
  const save = page.getByRole('button', { name: 'Зберегти налаштування описів' });
  await page.getByLabel('Заборонені слова').fill('ок, <script>');
  await expect(page.getByText(/лише літери, цифри/)).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel('Заборонені слова').fill(`ок, ${'а'.repeat(41)}`);
  await expect(page.getByText(/довше за 40 символів/)).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel('Заборонені слова').fill('ок');
  await expect(save).toBeEnabled();
});

test('without a key the switch is locked and the owner is told where to add one', async ({
  page,
}) => {
  await fixture(page, { keyUsable: false });
  await expect(page.getByText(/^Спочатку збережіть ключ OpenAI/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Увімкнути описи з ШІ' })).toBeDisabled();
});

test('selected editors are chosen from active staff and a stale revision is reported', async ({
  page,
}) => {
  const { calls, settings } = await fixture(page, { enabled: true, available: true });
  await page.getByLabel('Хто може генерувати описи').selectOption('selected');
  await page.getByRole('checkbox', { name: editor.email }).check();
  settings.revision = 5; // someone else saved meanwhile
  await page.getByRole('button', { name: 'Зберегти налаштування описів' }).click();
  await expect(
    page.getByText('Налаштування змінив інший користувач. Оновіть сторінку.'),
  ).toBeVisible();
  expect(calls[0]).toMatchObject({ accessMode: 'selected', selectedEditorIds: [editor.id] });
});

test('a deactivated editor is dropped from the selection with a notice, so the list can be saved', async ({
  page,
}) => {
  const gone = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const { calls } = await fixture(page, {
    enabled: true,
    available: true,
    accessMode: 'selected',
    selectedEditorIds: [editor.id, gone],
  });
  await expect(page.getByText(/^Неактивних співробітників прибрано/)).toBeVisible();
  await page.getByRole('button', { name: 'Зберегти налаштування описів' }).click();
  await expect(page.getByText('Налаштування описів збережено.')).toBeVisible();
  expect(calls[0].selectedEditorIds).toEqual([editor.id]);
});

test('in managed mode the owner is not sent to a key field that does not exist', async ({
  page,
}) => {
  await fixture(page, { keyUsable: false, keyMode: 'managed' });
  await expect(page.getByText(/^Ключ ШІ надає платформа/)).toBeVisible();
});
