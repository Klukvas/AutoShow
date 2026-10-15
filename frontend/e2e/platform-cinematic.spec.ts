import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidence = path.join(__dirname, 'platform-cinematic');
const listingId = '00000000-0000-4000-8000-000000000010';
const publicRoutes = ['/', '/cars', '/cars/bmw-5-series-fixture', '/collections/family', '/about', '/contacts', '/favorites', '/compare', '/cars?q=__empty', '/missing-platform-page'];
const adminRoutes = ['/admin', '/admin/listings', '/admin/listings/new', `/admin/listings/${listingId}/edit`, '/admin/leads', '/admin/reviews', '/admin/collections', '/admin/tags', '/admin/team', '/admin/branding', '/admin/audit'];

test.setTimeout(120_000);
test.use({ actionTimeout: 6000 });

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.locator('#login-email').fill('designer@fixture.invalid');
  await page.locator('#login-password').fill('fixture-password-123');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/listings$/);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [{ name: 'desktop', width: 1448, height: 1086 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const area of ['public', 'admin'] as const) {
    test(`${area} complete route matrix ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      if (area === 'admin') await login(page);
      const checks: Array<{ route: string; status: number | null; title: string[] }> = [];
      for (const route of area === 'public' ? publicRoutes : adminRoutes) {
        await test.step(route, async () => {
          const response = await page.goto(route);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator('h1:visible').first()).toBeVisible();
          await noOverflow(page);
          expect(response?.status()).toBe(route === '/missing-platform-page' ? 404 : 200);
          expect(pageErrors).toEqual([]);
          checks.push({ route, status: response?.status() ?? null, title: await page.locator('h1').allTextContents() });
          const file = `${area}-${viewport.name}-${route.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'}.png`;
          await page.screenshot({ path: path.join(evidence, file), fullPage: true });
        });
      }
      await writeFile(path.join(evidence, `coverage-${area}-${viewport.name}.json`), JSON.stringify(checks, null, 2));
    });
  }
}

test('theme preference initializes dark, honors explicit choices and stays stable across OS changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/cars');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Перемкнути тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: path.join(evidence, 'catalog-light.png') });
  await page.goto('/');
  await expect(page.locator('.homepage-cinematic').first()).toHaveCSS('background-color', 'rgb(11, 18, 23)');
  await expect(page.locator('#sell button[type="submit"]')).toHaveCSS('background-color', 'rgb(243, 243, 239)');
  await page.goto('/admin/login');
  await expect(page.locator('button[type="submit"]')).toHaveCSS('background-color', 'rgb(243, 243, 239)');
  await page.screenshot({ path: path.join(evidence, 'login-stored-light.png') });
  await page.goto('/cars');
  await page.getByRole('button', { name: 'Перемкнути тему' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('storage unavailable still initializes dark without an effect flipping it', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Test storage unavailable'); } }));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/cars');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('native filters have the cinematic surface and visible chevron in both themes', async ({ page }) => {
  await page.goto('/cars');
  for (const theme of ['dark', 'light']) {
    await page.locator('html').evaluate((node, theme) => node.setAttribute('data-theme', theme), theme);
    const select = page.locator('select.platform-select').first();
    await expect(select).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 27, 33)' : 'rgb(255, 255, 253)');
    await expect(select.locator('..').locator('svg')).toBeVisible();
    await expect(select.locator('..').locator('svg')).toHaveCSS('stroke-width', '1.5px');
  }
});

test('390 and 320 pixel mobile navigation and filter overlays cover the viewport and restore focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/cars');
    await noOverflow(page);
    const trigger = page.getByRole('button', { name: 'Відкрити меню' });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Навігація' });
    await expect(menu).toHaveCSS('position', 'fixed');
    await expect(menu).toHaveCSS('opacity', '1');
    const box = await menu.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width, height: 844 });
    for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
    expect(await menu.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    const filter = page.getByRole('button', { name: /^Фільтри/ });
    await filter.click();
    await expect(page.getByRole('dialog', { name: /Фільтри/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }
});

test('admin dialogs, preview colors, theme and mobile drawer preserve their working behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/admin/reviews');
  await page.getByRole('button', { name: /Додати відгук/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(18, 27, 33)');
  await expect(dialog).toHaveCSS('border-radius', '0px');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.goto('/admin/branding');
  await page.getByRole('button', { name: /Тема/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const preview = page.locator('.homepage-cinematic');
  await expect(preview).toHaveCSS('color', 'rgb(243, 243, 239)');
  await expect(preview).toHaveCSS('background-color', 'rgb(11, 18, 23)');
  await page.screenshot({ path: path.join(evidence, 'branding-light-preview.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/listings');
  await page.getByRole('button', { name: /Відкрити меню/ }).click();
  const menu = page.getByRole('dialog');
  await expect(menu).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});


test('keyboard focus stays visible on primary secondary cards and fields in both themes', async ({ page }) => {
  await page.goto('/cars');
  for (const theme of ['dark', 'light']) {
    await page.locator('html').evaluate((node, theme) => node.setAttribute('data-theme', theme), theme);
    for (const control of [page.getByRole('button', { name: 'Перемкнути тему' }), page.locator('header a.af-cta'), page.locator('.home-listing-photo-link').first(), page.locator('select.platform-select').first()]) {
      await control.focus();
      await expect(control).toHaveCSS('outline-style', 'solid');
      await expect(control).toHaveCSS('outline-width', '2px');
    }
  }
  await page.goto('/contacts');
  const submit = page.locator('button[type="submit"]').first();
  await submit.focus();
  await expect(submit).toHaveCSS('outline-style', 'solid');
  await login(page);
  const primary = page.getByRole('link', { name: /Створити об/ }).first();
  await page.keyboard.press('Tab');
  await primary.focus();
  await expect(primary).toHaveCSS('outline-style', 'solid');
});

test('saved inventory, gallery and calculator lead keep their existing behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cars');
  const card = page.locator('.home-listing-card').first();
  await card.getByRole('button', { name: 'Додати в обране' }).click();
  await card.getByRole('button', { name: 'Додати до порівняння' }).click();
  await page.goto('/favorites');
  await expect(page.locator('.home-listing-card')).toHaveCount(1);
  await page.goto('/compare');
  await expect(page.getByText('BMW 5 Series 530i xDrive').first()).toBeVisible();
  await page.goto('/cars/bmw-5-series-fixture');
  await page.getByRole('button', { name: 'На весь екран' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Купити в кредит', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Надіслати заявку', exact: true }) }).last();
  await form.getByRole('button', { name: 'Надіслати заявку', exact: true }).click();
  await expect(form.getByText('Перевірте ім’я та номер телефону')).toBeVisible();
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { id: 'isolated-credit', status: 'new' }, headers: { 'access-control-allow-origin': '*' } });
  });
  await form.locator('[name="name"]').fill('Тестовий покупець');
  await form.locator('[name="phone"]').fill('+380000000000');
  await form.getByRole('button', { name: 'Надіслати заявку', exact: true }).click();
  await expect(page.getByText('Заявку прийнято! Менеджер зв’яжеться з вами щодо умов кредиту.')).toBeVisible();
  expect(submitted).toMatchObject({ type: 'credit', listingId: 'fixture-0' });
});

test('actual loading and recoverable errors render with the cinematic palette', async ({ page }) => {
  const { build } = await import('esbuild');
  const bundle = await build({ entryPoints: [path.join(evidence, 'visual-states.tsx')], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, tsconfig: path.join(__dirname, '../tsconfig.json') });
  await page.goto('/cars');
  const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href));
  const fonts = await page.locator('html').getAttribute('class');
  await page.route('**/__platform-visual**', (route) => route.fulfill({ contentType: 'text/html', body: `<html lang="uk" data-theme="dark" class="${fonts}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body class="platform-cinematic bg-bg text-ink"><div id="root"></div></body></html>` }));
  for (const mode of ['loading', 'admin-error', 'public-error']) {
    await page.goto(`/__platform-visual?mode=${mode}`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByTestId('resets')).toHaveText('0');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 18, 23)');
    await page.screenshot({ path: path.join(evidence, `${mode}.png`) });
    if (mode !== 'loading') {
      await page.getByRole('button').first().click();
      await expect(page.getByTestId('resets')).toHaveText('1');
    }
  }
});

test('photo action contrast remains accessible in both themes and display preferences', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.goto('/cars');
  for (const enhanced of [false, true]) {
    await cdp.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-transparency', value: enhanced ? 'reduce' : 'no-preference' },
      { name: 'prefers-contrast', value: enhanced ? 'more' : 'no-preference' },
    ] });
    for (const theme of ['dark', 'light']) {
      await page.locator('html').evaluate((node, theme) => node.setAttribute('data-theme', theme), theme);
      const card = page.locator('.home-listing-card').first();
      for (const selected of [false, true]) {
        for (const button of await card.locator('.inventory-photo-control').all()) {
          if ((await button.getAttribute('aria-pressed')) !== String(selected)) await button.click();
          const contrast = await button.evaluate((node) => {
            const svg = node.querySelector('svg');
            if (!svg) throw new Error('Photo controls require a visible icon');
            const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
            const foreground = rgb(getComputedStyle(svg).stroke);
            const background = rgb(getComputedStyle(node).backgroundColor);
            const alpha = background[3] ?? 1;
            const opaqueBackground = background.slice(0, 3).map((value) => value * alpha + 255 * (1 - alpha));
            const luminance = (channels: number[]) => channels.slice(0, 3).reduce((sum, value, index) => {
              const channel = value / 255;
              return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
            }, 0);
            const first = luminance(foreground), second = luminance(opaqueBackground);
            return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
          });
          expect(contrast).toBeGreaterThanOrEqual(3);
          if (enhanced) await expect(button).toHaveCSS('backdrop-filter', 'none');
        }
      }
      await page.screenshot({ path: path.join(evidence, `photo-controls-${theme}-${enhanced ? 'enhanced' : 'normal'}.png`) });
    }
  }
});

test('compact headings stay regular and fixed dark preview uses the real derived accent', async ({ page }) => {
  await page.goto('/cars/bmw-5-series-fixture');
  await expect(page.getByRole('heading', { name: 'Розрахунок кредиту' })).toHaveCSS('font-weight', '500');
  await login(page);
  await page.goto('/admin/branding');
  await page.getByLabel('Акцентний колір', { exact: true }).fill('#111827');
  const preview = page.locator('.homepage-cinematic');
  await expect.poll(() => preview.evaluate((node) => getComputedStyle(node).getPropertyValue('--accent').trim())).toBe('113 138 193');
  await expect(preview.locator('[aria-label="Колір #111827"]')).toHaveCSS('background-color', 'rgb(113, 138, 193)');
  await expect(preview.locator('.platform-primary')).toHaveCSS('background-color', 'rgb(243, 243, 239)');
  await page.screenshot({ path: path.join(evidence, 'branding-derived-dark-accent.png'), fullPage: true });
});
