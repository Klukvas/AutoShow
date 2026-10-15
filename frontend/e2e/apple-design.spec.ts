import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';

let fixtureScript = '';

test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: [path.join(__dirname, 'fixtures/apple-design.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    tsconfig: path.join(__dirname, '../tsconfig.json'),
  });
  fixtureScript = bundle.outputFiles[0].text;
});

async function openFixture(page: Page) {
  await page.goto('/cars');
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  await page.route('**/__apple-design-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html lang="uk" data-theme="light"><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}
      </head><body class="platform-cinematic bg-bg text-ink"><div id="root"></div></body></html>`,
    }),
  );
  await page.goto('/__apple-design-test');
  // Deny every real API call from the isolated component fixture.
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.addScriptTag({ content: fixtureScript });
  await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeVisible();
}

test('mobile navigation traps focus, restores it after exit and can reopen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cars');
  const trigger = page.getByRole('button', { name: /Відкрити меню/i });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 844 });
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('filter sheet respects reduced motion and releases its scroll lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cars');
  await page.getByRole('button', { name: /^Фільтри/i }).click();
  const sheet = page.getByRole('dialog', { name: /Фільтри/i });
  await expect(sheet).toBeVisible();
  const panel = sheet.locator('.material-panel');
  await expect(panel).toHaveCSS('transform', 'none');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('nested dialogs and row menus dismiss only the active layer', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
  const parent = page.getByRole('dialog', { name: 'Parent dialog', exact: true });
  await page.getByRole('button', { name: 'Open child' }).click();
  const child = page.getByRole('dialog', { name: 'Child dialog', exact: true });
  await expect(child).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(child).toBeHidden();
  await expect(parent).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('button', { name: 'Open child' })).toBeFocused();
  await parent.getByRole('button', { name: 'Меню дій' }).click();
  await expect(page.getByRole('menuitem', { name: 'First action' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Second action' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(parent).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(parent).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused();
});

test('combobox navigates by keyboard and commits on release, not press', async ({ page }) => {
  await openFixture(page);
  const input = page.getByRole('combobox', { name: 'Make' });
  await input.focus();
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.getByTestId('selected')).toHaveText('bmw');
  await input.fill('Vol');
  const option = page.getByRole('option', { name: 'Volvo' });
  await option.hover();
  await page.mouse.down();
  await expect(page.getByTestId('selected')).toHaveText('bmw');
  await page.mouse.up();
  await expect(page.getByTestId('selected')).toHaveText('volvo');
});

test('toast pauses dismissal while keyboard focus is inside', async ({ page }) => {
  await page.clock.install();
  await openFixture(page);
  await page.getByRole('button', { name: 'Show toast' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Saved successfully' });
  await toast.getByRole('button').focus();
  await page.clock.runFor(6000);
  await expect(toast).toBeVisible();
  await page.getByRole('button', { name: 'Show toast' }).focus();
  await page.clock.runFor(5000);
  await expect(toast).toBeHidden();
});

test('floating surfaces honor transparency and contrast preferences in both themes', async ({
  page,
}) => {
  await page.goto('/cars');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'reduce' },
      { name: 'prefers-contrast', value: 'more' },
    ],
  });
  for (const theme of ['light', 'dark']) {
    await page
      .locator('html')
      .evaluate((node, value) => node.setAttribute('data-theme', value), theme);
    const header = page.locator('header.material-bar');
    await expect(header).toHaveCSS('backdrop-filter', 'none');
    expect(await header.evaluate((node) => getComputedStyle(node).backgroundColor)).toMatch(
      /^rgb\(/,
    );
    expect(
      await page
        .locator('.cinematic-interior')
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return (
            style.getPropertyValue('--line').trim() !== '' && style.getPropertyValue('--line').trim() !== style.getPropertyValue('--bg').trim()
          );
        }),
    ).toBe(true);
  }
});

test('200% text stays inside the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cars');
  await page.locator('html').evaluate((node) => {
    node.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Відкрити меню/i }).click();
  const menu = page.getByRole('dialog');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((node) => node.scrollWidth <= innerWidth)).toBe(true);
});

test('media tile follows the pointer and cancellation never commits a reorder', async ({
  page,
}) => {
  await openFixture(page);
  const tile = page.locator('[data-media-tile="0"]').first();
  const handle = tile.getByRole('button', { name: /перетяг/i });
  const box = await handle.boundingBox();
  const before = await tile.boundingBox();
  if (!box || !before) throw new Error('Media controls must have layout');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y + 30, { steps: 5 });
  await expect(page.getByTestId('drag-result')).toHaveText('dragging');
  await expect
    .poll(async () => {
      const current = await tile.boundingBox();
      return current ? Math.round(current.x - before.x) : null;
    })
    .toBe(50);
  await handle.dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  });
  await expect(page.getByTestId('drag-result')).toHaveText('cancelled');
  await page.mouse.up();
  await expect(page.getByTestId('drag-result')).toHaveText('cancelled');
});

test('media reorder submits once on drop and keeps keyboard focus on the moved tile', async ({
  page,
}) => {
  await openFixture(page);
  const orders: string[][] = [];
  await page.route('**/admin/api/token', (route) =>
    route.fulfill({ json: { accessToken: 'test-fixture' } }),
  );
  await page.route('**/api/admin/listings/test-listing/media/reorder', (route) => {
    orders.push(route.request().postDataJSON().ids);
    return route.fulfill({ status: 204 });
  });
  const manager = page.getByTestId('media-manager');
  const handle = manager.locator('[data-media-tile="0"]').getByRole('button', { name: /перетяг/i });
  const target = manager.locator('[data-media-tile="1"]');
  const origin = await handle.boundingBox();
  const destination = await target.boundingBox();
  if (!origin || !destination) throw new Error('Reorder targets must be visible');
  const start = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 5 },
  );
  await page.mouse.move(start.x, start.y, { steps: 5 });
  await page.mouse.up();
  await expect(handle.locator('..')).toHaveCSS('transform', 'none');
  expect(orders).toHaveLength(0);
  await handle.dragTo(target);
  await expect.poll(() => orders.length).toBe(1);
  expect(orders[0]).toEqual(['second', 'first']);
  const moved = manager.locator('[data-media-tile="1"]').getByRole('button', { name: /перетяг/i });
  await moved.focus();
  await moved.press('ArrowLeft');
  await expect.poll(() => orders.length).toBe(2);
  expect(orders[1]).toEqual(['first', 'second']);
  await expect(
    manager.locator('[data-media-tile="0"]').getByRole('button', { name: /перетяг/i }),
  ).toBeFocused();
});
