import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  PhotoAiAllowedWorkspace,
  PhotoAiGeneration,
  PhotoAiSettingsMetadata,
} from '../src/lib/admin/photo-ai';

let server: Server;
let origin = '';
const presets = (
  [
    ['natural', 'enhance', 'Природне покращення'],
    ['dark', 'enhance', 'Темне фото'],
    ['interior', 'enhance', 'Салон'],
    ['consistent', 'enhance', 'Єдиний стиль оголошення'],
    ['studio', 'scene', 'Світла студія'],
    ['golden', 'scene', 'Золота година'],
    ['morning', 'scene', 'Місто вранці'],
    ['evening', 'scene', 'Вечірнє місто'],
    ['concrete', 'scene', 'Мінімалістичний бетон'],
  ] as const
).map(([id, category, name]) => ({ id, category, name, description: `Опис пресету «${name}».` }));
function picture(result = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${result ? '#d6d8d4' : '#b2b8ba'}"/><path d="M0 620H1200" stroke="#777" stroke-width="4"/><path d="M180 545L260 420L770 420L880 530L1010 570L1010 640H140V585Z" fill="#273b49"/><path d="M290 435H745L823 528H242Z" fill="#9fc1cf"/><circle cx="310" cy="632" r="70" fill="#161e24"/><circle cx="856" cy="632" r="70" fill="#161e24"/><path d="M565 576L635 568" stroke="#ced7dc" stroke-width="4"/><text x="30" y="55" fill="#334" font-size="24">LOCAL TEST FIXTURE</text></svg>`;
}
test.beforeAll(async () => {
  const bundled = await build({
    entryPoints: [path.join(__dirname, 'photo-ai.fixture.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    tsconfig: path.join(__dirname, '../tsconfig.json'),
    plugins: [
      {
        name: 'fixture-navigation',
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: 'fixture-navigation',
            namespace: 'photo-ai-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'photo-ai-fixture' }, () => ({
            contents: 'export function useRouter(){ return {refresh(){},push(){},replace(){}}; }',
          }));
        },
      },
    ],
  });
  // Consume actual built app styles and local fonts. Build before this test.
  const cssDir = path.join(__dirname, '../.next/static/css');
  const cssFiles = (await readdir(cssDir)).filter((name) => name.endsWith('.css'));
  const css = (
    await Promise.all(cssFiles.map((name) => readFile(path.join(cssDir, name), 'utf8')))
  ).join('\n');
  const fontDir = path.join(__dirname, '../.next/static/media');
  const fonts = new Map(
    await Promise.all(
      (await readdir(fontDir))
        .filter((name) => name.endsWith('.woff2'))
        .map(async (name) => [name, await readFile(path.join(fontDir, name))] as const),
    ),
  );
  server = createServer((req, res) => {
    if (req.url === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundled.outputFiles[0].text);
    } else if (req.url === '/style.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end(
        css +
          ':root{--font-sans:Onest,Arial,sans-serif;--font-display:"Schibsted Grotesk",Arial,sans-serif;}',
      );
    } else if (req.url?.startsWith('/_next/static/media/')) {
      const font = fonts.get(req.url.split('/').pop() ?? '');
      res.setHeader('Content-Type', 'font/woff2');
      res.end(font);
    } else if (req.url?.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(picture(req.url === '/result.svg'));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="uk" data-theme="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="platform-cinematic bg-bg text-ink"><div id="root"></div><script src="/fixture.js"></script></body></html>',
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

async function fixture(
  page: Page,
  enabled = true,
  lostResponse = false,
  settingsPage = false,
  delayStaff = false,
  initialSettings: Partial<PhotoAiSettingsMetadata> = {},
) {
  const state: PhotoAiAllowedWorkspace = {
    permitted: true,
    permissionReason: null,
    enabled,
    reason: enabled ? null : 'Обробка ШІ поки недоступна.',
    mediaId: 'media',
    revision: 0,
    activeGenerationId: null,
    originalUrl: `${origin}/original.svg`,
    history: [],
    builtins: presets,
    presets: [],
  };
  const settings: PhotoAiSettingsMetadata = {
    mode: 'own_key',
    accessMode: 'all',
    selectedEditorIds: [],
    configured: false,
    enabled: false,
    available: false,
    setupAvailable: true,
    revision: 0,
    status: 'not-configured',
    ...initialSettings,
  };
  let credential: string | null = null;
  const identity = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'editor' };
  const staff = [
    { id: identity.id, email: 'editor@example.test' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'other@example.test' },
  ];
  let releaseStaff: () => void = () => undefined;
  const staffReady = new Promise<void>((resolve) => {
    releaseStaff = resolve;
  });
  const brandingCalls: object[] = [];
  const settingsCalls: object[] = [];
  const calls: Array<{ requestId: string; prompt: string; category: string; presetId?: string }> =
    [];
  let lost = lostResponse;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    // All actual API/storage/provider traffic is blocked; only in-memory data.
    if (url.pathname === '/admin/api/token')
      return route.fulfill({ json: { accessToken: 'local-fixture-token' } });
    if (url.pathname.startsWith('/api/')) {
      const body = ['POST', 'PATCH'].includes(route.request().method())
        ? route.request().postDataJSON()
        : null;
      if (url.pathname === '/api/admin/photo-ai/settings/staff') {
        if (delayStaff) await staffReady;
        return route.fulfill({ json: staff });
      }
      if (url.pathname === '/api/admin/photo-ai/settings') {
        if (body) {
          settingsCalls.push(body);
          if (body.expectedRevision !== settings.revision)
            return route.fulfill({
              status: 409,
              json: { message: 'Налаштування змінив інший користувач. Оновіть сторінку.' },
            });
          if (body.removeKey) {
            credential = null;
            settings.enabled = false;
          } else {
            if (body.apiKey?.trim()) credential = body.apiKey.trim();
            settings.enabled = body.enabled ?? settings.enabled;
          }
          settings.accessMode = body.accessMode ?? settings.accessMode;
          settings.selectedEditorIds = body.selectedEditorIds ?? settings.selectedEditorIds;
          settings.configured = Boolean(credential);
          settings.available = settings.enabled && settings.configured;
          settings.revision++;
          settings.status = !settings.configured
            ? 'not-configured'
            : settings.enabled
              ? 'ready'
              : 'disabled';
          state.enabled = settings.available;
          state.reason = settings.available ? null : 'Обробка ШІ поки недоступна.';
        }
        return route.fulfill({ json: settings });
      }
      // The branding page also shows the AI descriptions card; keep it quiet here.
      if (url.pathname === '/api/admin/listing-ai/settings')
        return route.fulfill({
          json: {
            enabled: false,
            accessMode: 'all',
            selectedEditorIds: [],
            revision: 0,
            keyUsable: false,
            keyMode: 'own_key',
            available: false,
            brandVoice: { tone: '', bannedWords: [], example: '' },
          },
        });
      if (url.pathname === '/api/admin/branding') {
        brandingCalls.push(body);
        return route.fulfill({ json: body });
      }
      if (url.pathname.endsWith('/generations')) {
        calls.push(body);
        const preset = presets.find((p) => p.id === body.presetId);
        let generation = state.history.find(
          (g) =>
            g.prompt === body.prompt &&
            g.category === body.category &&
            g.presetId === (body.presetId ?? null),
        );
        if (!generation) {
          generation = {
            id: `g${state.history.length}`,
            category: body.category,
            presetId: preset?.id ?? null,
            presetName: preset?.name ?? null,
            prompt: body.prompt,
            status: 'queued',
            failureReason: null,
            createdAt: new Date().toISOString(),
            sceneAltered: body.category === 'scene',
            previewUrl: null,
          };
          state.history.unshift(generation);
        }
        if (lost) {
          lost = false;
          generation.status = 'ready';
          generation.previewUrl = `${origin}/result.svg`;
          return route.abort('failed');
        }
        return route.fulfill({ status: 202, json: generation });
      }
      if (url.pathname.endsWith('/apply')) {
        state.activeGenerationId = body.generationId;
        state.revision++;
        return route.fulfill({ json: { revision: state.revision } });
      }
      if (url.pathname.endsWith('/restore')) {
        state.activeGenerationId = null;
        state.revision++;
        return route.fulfill({ json: { revision: state.revision } });
      }
      if (url.pathname.endsWith('/presets')) {
        const preset = { ...body, id: `p${state.presets.length}` };
        state.presets.unshift(preset);
        return route.fulfill({ status: 201, json: preset });
      }
      if (url.pathname.endsWith('/photo-ai')) {
        const permitted =
          identity.role === 'admin' ||
          settings.accessMode === 'all' ||
          (settings.accessMode === 'selected' && settings.selectedEditorIds.includes(identity.id));
        return route.fulfill({
          json: permitted
            ? state
            : {
                permitted: false,
                permissionReason: 'Власник сайту не надав вам доступу до обробки фото з ШІ.',
              },
        });
      }
      if (url.pathname === '/api/admin/listings/listing')
        return route.fulfill({
          json: {
            media: [
              {
                id: 'media',
                thumbUrl: state.activeGenerationId
                  ? `${origin}/result.svg`
                  : `${origin}/original.svg`,
              },
            ],
          },
        });
      return route.fulfill({ status: 503, json: { message: 'Fixture denies unrelated API' } });
    }
    if (url.origin !== origin) return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.goto(settingsPage ? `${origin}/settings` : origin);
  if (settingsPage) {
    await expect(
      page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }),
    ).toBeVisible();
    return { state, calls, settings, brandingCalls, settingsCalls, identity, staff, releaseStaff };
  }
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Редагування фото з ШІ' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Природне покращення', exact: true }),
  ).toBeVisible();
  return { state, calls, settings, brandingCalls, settingsCalls, identity, staff, releaseStaff };
}

test('preset, durable processing, explicit apply, original restore, saved custom scene and reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const { state, calls } = await fixture(page);
  await page.getByRole('button', { name: 'Змінити сцену', exact: true }).click();
  await page.getByRole('button', { name: 'Власна сцена', exact: true }).click();
  await page.getByLabel('Фон', { exact: true }).fill('Quiet concrete courtyard');
  await page.getByLabel('Час доби', { exact: true }).fill('Dawn');
  await page.getByLabel('Освітлення й погода').fill('Cloudy, dry');
  await page.getByLabel('Додаткові побажання').fill('Soft natural reflections');
  await page.getByRole('button', { name: 'Скласти інструкцію' }).click();
  await page.getByLabel('Інструкція для ШІ').fill('Custom scene prompt, keep vehicle scratches');
  await page.getByLabel('Назва пресету').fill('My courtyard');
  await page.getByRole('button', { name: 'Зберегти пресет' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Пресет збережено.' })).toBeVisible();
  await page.getByRole('button', { name: 'Створити варіант', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'У черзі' })).toBeVisible();
  expect(state.activeGenerationId).toBeNull();
  expect(calls[0].category).toBe('scene');
  await page.getByRole('dialog').getByRole('button', { name: 'Закрити', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'У черзі' })).toBeVisible();
  state.history[0].status = 'ready';
  state.history[0].previewUrl = `${origin}/result.svg`;
  await page.getByRole('button', { name: 'Оновити історію' }).click();
  const apply = page.getByRole('button', { name: 'Застосувати до оголошення', exact: true });
  await expect(apply).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Відкрити фото в повному розмірі' })).toHaveCount(2);
  await page.getByRole('checkbox').check();
  await apply.click();
  await expect(page.getByRole('button', { name: 'Застосовано', exact: true })).toBeDisabled();
  expect(state.activeGenerationId).toBe('g0');
  await page.getByRole('button', { name: 'Відновити оригінал', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Оригінал відновлено.' })).toBeVisible();
  expect(state.activeGenerationId).toBeNull();
  await page.getByLabel('Мої пресети').selectOption('p0');
  await expect(page.getByLabel('Інструкція для ШІ')).toHaveValue(
    'Custom scene prompt, keep vehicle scratches',
  );
  await expect(page.getByRole('button', { name: 'Змінити сцену', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('dialog').evaluate((node) => {
    if (node.parentElement) node.parentElement.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(__dirname, 'photo-ai-desktop.png'), fullPage: true });
});
test('disabled setup stays browsable and mobile keyboard focus/scroll are contained', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page, false);
  await expect(page.getByText('Обробка ШІ поки недоступна.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Природне покращення', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Створити варіант', exact: true })).toBeDisabled();
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('body')).toHaveCSS('font-family', /Onest/);
  await dialog.evaluate((node) => {
    if (node.parentElement) node.parentElement.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(__dirname, 'photo-ai-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Редагувати з ШІ', exact: true })).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
test('our preset is sent by id with optional wishes; history shows its name, not instructions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const { calls } = await fixture(page);
  await page.getByRole('button', { name: 'Змінити сцену', exact: true }).click();
  const studio = page.getByRole('button', { name: 'Світла студія', exact: true });
  await studio.click();
  await expect(studio).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Опис пресету «Світла студія».', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Назва пресету')).toHaveCount(0);
  const wishes = page.getByLabel('Побажання до пресету (необов’язково)');
  await expect(wishes).toHaveValue('');
  await page.getByRole('button', { name: 'Створити варіант', exact: true }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toMatchObject({ category: 'scene', presetId: 'studio', prompt: '' });
  const history = page.getByRole('button', { name: /Світла студія/ }).filter({ hasText: 'Сцена' });
  await expect(history).toBeVisible();
  await wishes.fill('Темніша підлога');
  await studio.click();
  await expect(wishes).toHaveValue('Темніша підлога');
  await expect(page.getByRole('group', { name: 'Готові пресети' })).toBeVisible();
  await page
    .getByRole('dialog')
    .screenshot({ path: test.info().outputPath('photo-ai-builtin-preset.png') });

  await page.getByRole('button', { name: 'Свій промпт', exact: true }).click();
  await expect(studio).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Інструкція для ШІ')).toBeVisible();
  await expect(page.getByLabel('Назва пресету')).toBeVisible();
});

test('lost response retries the same paid request identity', async ({ page }) => {
  const { calls } = await fixture(page, true, true);
  await page.getByRole('button', { name: 'Природне покращення', exact: true }).click();
  await page.getByRole('button', { name: 'Створити варіант', exact: true }).click();
  await expect(page.getByText('Failed to fetch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Оновити історію' }).click();
  await page.getByRole('button', { name: 'Створити варіант', exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[0].requestId).toBe(calls[1].requestId);
});

test('owner saves shared credential independently; blank preserves, disable/replacement/remove apply to staff without restart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { settings, settingsCalls, brandingCalls } = await fixture(page, false, false, true);
  const key = page.getByLabel('API-ключ OpenAI', { exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await expect(key).toHaveValue('');
  await key.fill('fixture-owner-key-123456789');
  await page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ' }).check();
  await key.press('Enter');
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  await expect(key).toHaveValue('');
  expect(brandingCalls).toHaveLength(0);
  expect(settings.available).toBe(true);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await page.getByRole('button', { name: 'Природне покращення', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Створити варіант', exact: true })).toBeEnabled();
  await page.goto(`${origin}/settings`);
  await expect(key).toHaveValue('');
  await page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ' }).uncheck();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settings.configured).toBe(true);
  expect(settings.available).toBe(false);
  expect(settingsCalls[1]).not.toHaveProperty('apiKey');
  await key.fill('fixture-replacement-key-987654321');
  await page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ' }).check();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(key).toHaveValue('');
  expect(settings.available).toBe(true);
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect.poll(() => brandingCalls.length).toBe(1);
  expect(brandingCalls[0]).not.toHaveProperty('apiKey');
  expect(settings.available).toBe(true);
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Обробка фото з ШІ', exact: true }) });
  await panel.screenshot({ path: path.join(__dirname, 'photo-ai-settings-owner.png') });
  await page.getByRole('button', { name: 'Видалити ключ', exact: true }).click();
  await page.getByRole('button', { name: 'Видалити ключ і вимкнути', exact: true }).click();
  await expect(
    page.getByText('Ключ видалено. Обробку фото вимкнено.', { exact: true }),
  ).toBeVisible();
  expect(settings.configured).toBe(false);
  expect(settings.enabled).toBe(false);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await page.getByRole('button', { name: 'Природне покращення', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Створити варіант', exact: true })).toBeDisabled();
});

test('first key ticks the switch by itself; a saved-but-disabled key shows a warning', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { settings, settingsCalls } = await fixture(page, false, false, true);
  const key = page.getByLabel('API-ключ OpenAI', { exact: true });
  const toggle = page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ' });
  const warning = page.getByText(/^Обробку фото вимкнено — співробітники не можуть/);
  await expect(toggle).not.toBeChecked();
  await key.fill('fixture-owner-key-123456789');
  await expect(toggle).toBeChecked();
  await key.fill('');
  await expect(toggle).not.toBeChecked();
  await key.fill('fixture-owner-key-123456789');
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settingsCalls[0]).toMatchObject({ enabled: true });
  expect(settings.available).toBe(true);
  await expect(warning).toBeHidden();

  await toggle.uncheck();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(warning).toBeVisible();
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Обробка фото з ШІ', exact: true }) })
    .screenshot({ path: test.info().outputPath('photo-ai-disabled-warning.png') });
  await key.fill('fixture-replacement-key-987654321');
  await expect(toggle).not.toBeChecked();
});

test('managed mode warns while processing is off and stays quiet once it is on', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const managed = { mode: 'managed', configured: true } as const;
  const warning = page.getByText(/^Обробку фото вимкнено — співробітники не можуть/);
  await fixture(page, false, false, true, false, { ...managed, status: 'disabled' });
  await expect(warning).toBeVisible();
  await expect(page.getByRole('status').filter({ has: warning })).toHaveCount(1);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await fixture(page, false, false, true, false, {
    ...managed,
    enabled: true,
    available: true,
    status: 'ready',
  });
  await expect(page.getByText('Обробку фото з ШІ увімкнено.', { exact: true })).toBeVisible();
  await expect(warning).toBeHidden();
});

test('owner who unticks the switch before the first save keeps it off', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { settings, settingsCalls } = await fixture(page, false, false, true);
  const key = page.getByLabel('API-ключ OpenAI', { exact: true });
  const toggle = page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ' });
  await key.fill('fixture-owner-key-123456789');
  await toggle.uncheck();
  await key.fill('fixture-owner-key-1234567890');
  await expect(toggle).not.toBeChecked();
  await key.press('Enter');
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settingsCalls[0]).toMatchObject({ enabled: false });
  expect(settings.configured).toBe(true);
  await expect(page.getByText(/^Обробку фото вимкнено — співробітники не можуть/)).toBeVisible();
});

test('owner selects all three access modes; denied editors keep ordinary media actions; stale selections can be saved', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { settings, staff, identity } = await fixture(page, false, false, true);
  const mode = page.getByLabel('Хто може користуватися ШІ');
  await expect(mode).toHaveValue('all');
  await mode.selectOption('admins');
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settings.accessMode).toBe('admins');
  await page.goto(origin);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(
    page.getByText('Власник сайту не надав вам доступу до обробки фото з ШІ.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Створити варіант', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Історія варіантів' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: path.join(__dirname, 'photo-ai-access-denied.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Видалити файл', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Перетягнути (стрілки ← → для зміни порядку)', exact: true }),
  ).toBeEnabled();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'оберіть файли', exact: true }).first().click();
  await (await chooser).setFiles([]);
  await page.goto(`${origin}/settings`);
  await mode.selectOption('all');
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settings.accessMode).toBe('all');
  await page.goto(origin);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Природне покращення', exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/settings`);
  await mode.selectOption('selected');
  await page.getByRole('checkbox', { name: 'editor@example.test', exact: true }).check();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settings.selectedEditorIds).toEqual([identity.id]);
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Обробка фото з ШІ', exact: true }) });
  await panel.screenshot({ path: path.join(__dirname, 'photo-ai-access-owner.png') });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Природне покращення', exact: true }),
  ).toBeVisible();
  identity.id = staff[1].id;
  await page.reload();
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(
    page.getByText('Власник сайту не надав вам доступу до обробки фото з ШІ.', { exact: true }),
  ).toBeVisible();
  staff.splice(0, 1);
  await page.goto(`${origin}/settings`);
  await expect(
    page.getByText(
      'Недоступних редакторів вилучено з вибору. Збережіть налаштування, щоб оновити список.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settings.selectedEditorIds).toEqual([]);
});

test('delayed staff lookup preserves owner draft mode and enabled state; Enter waits for staff before saving', async ({
  page,
}) => {
  const { releaseStaff, settingsCalls } = await fixture(page, false, false, true, true);
  const mode = page.getByLabel('Хто може користуватися ШІ');
  await mode.selectOption('selected');
  const enabled = page.getByRole('checkbox', { name: 'Увімкнути обробку фото з ШІ', exact: true });
  await enabled.check();
  const key = page.getByLabel('API-ключ OpenAI', { exact: true });
  await key.fill('fixture-owner-key-123456789');
  await key.press('Enter');
  expect(settingsCalls).toHaveLength(0);
  releaseStaff();
  await expect(
    page.getByRole('checkbox', { name: 'editor@example.test', exact: true }),
  ).toBeVisible();
  await expect(mode).toHaveValue('selected');
  await expect(enabled).toBeChecked();
  await page.getByRole('checkbox', { name: 'editor@example.test', exact: true }).check();
  await page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }).click();
  await expect(page.getByText('Налаштування ШІ збережено.', { exact: true })).toBeVisible();
  expect(settingsCalls).toHaveLength(1);
});
