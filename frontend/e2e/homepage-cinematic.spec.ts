import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const populated = process.env.HOMEPAGE_POPULATED === '1';
const evidence = path.join(__dirname, 'homepage-cinematic');

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function assertMenuCoversViewport(page: Page) {
  const menu = page.getByRole('dialog', { name: 'Навігація' });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('A viewport is required for mobile menu coverage');
  await expect(menu).toHaveCSS('position', 'fixed');
  await expect(menu).toHaveCSS('opacity', '1');
  await expect.poll(async () => {
    const box = await menu.boundingBox();
    return box ? {
      x: Math.round(box.x), y: Math.round(box.y),
      width: Math.round(box.width), height: Math.round(box.height),
    } : null;
  }).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
}

async function capture(page: Page, name: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('h1')).toHaveText('Знайдіть авто, яке вам підходить.');
  await expect(page.getByText('Більше, ніж просто автомобілі', { exact: true })).toHaveCount(0);
  await assertNoOverflow(page);
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}

test('homepage desktop and mobile use the cinematic shell and accessible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await capture(page, populated ? 'populated-desktop' : 'fallback-desktop');
  await expect(page.locator('.homepage-cinematic')).toHaveCSS('background-color', 'rgb(11, 18, 23)');
  await expect(page.getByRole('button', { name: 'Перемкнути тему' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Обрати автомобіль' })).toHaveAttribute('href', '/cars');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, populated ? 'populated-mobile' : 'fallback-mobile');
  const trigger = page.getByRole('button', { name: 'Відкрити меню' });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Навігація' });
  await expect(menu).toBeVisible();
  await assertMenuCoversViewport(page);
  await expect(menu).toHaveCSS('background-color', 'rgb(11, 18, 23)');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('Tab');
  expect(await menu.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: path.join(evidence, populated ? 'populated-menu.png' : 'fallback-menu.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await menu.getByRole('link', { name: 'Про нас', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.homepage-cinematic')).toHaveCount(0);
  await expect(page.locator('.theme-vitrina-paper').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Перемкнути тему' })).toBeVisible();
});

test('homepage remains readable with dark storage, high contrast, reduced motion and enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark', contrast: 'more' });
  await page.goto('/');
  await expect(page.locator('.homepage-cinematic')).toHaveCSS('background-color', 'rgb(11, 18, 23)');
  await page.locator('html').evaluate((node) => { node.style.fontSize = '200%'; });
  await assertNoOverflow(page);
  await page.getByRole('button', { name: 'Відкрити меню' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await assertMenuCoversViewport(page);
  await page.screenshot({ path: path.join(evidence, populated ? 'populated-menu-enlarged.png' : 'fallback-menu-enlarged.png') });
  expect(await page.getByRole('dialog').evaluate((node) => node.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('sales form validates and sends the unchanged lead contract using a blocked real network', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { id: 'isolated-test', status: 'new' }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  const form = page.locator('#sell form');
  await form.getByRole('button', { name: 'Надіслати заявку' }).click();
  await expect(form.getByText('Обов’язкове поле')).toHaveCount(2);
  await expect(form.getByText('Вкажіть коректний номер телефону')).toBeVisible();
  expect(submitted).toBeUndefined();
  await form.locator('[name="carMake"]').fill('Toyota');
  await form.locator('[name="name"]').fill('Тестовий користувач');
  await form.locator('[name="phone"]').fill('+380000000000');
  await form.getByRole('button', { name: 'Надіслати заявку' }).click();
  await expect(page.getByText('Дякуємо! Ми зателефонуємо вам найближчим часом.')).toBeVisible();
  expect(submitted).toMatchObject({ type: 'sell_request', name: 'Тестовий користувач', phone: '+380000000000', carMake: 'Toyota', website: '' });
});

test('fallback offers catalogue and contact paths without invented inventory or metrics', async ({ page }) => {
  test.skip(populated, 'Run against the initial backend-unavailable production preview.');
  await page.goto('/');
  await expect(page.locator('.home-hero-empty')).toBeVisible();
  await expect(page.locator('.home-listing-card')).toHaveCount(0);
  await expect(page.locator('.home-stats-value')).toHaveCount(0);
  await expect(page.locator('.home-featured-link')).toHaveCount(0);
  await expect(page.locator('.home-hero-bottom a')).toHaveAttribute('href', '/contacts#lead');
  await page.getByRole('link', { name: 'Обрати автомобіль' }).click();
  await expect(page).toHaveURL(/\/cars$/);
  await expect(page.locator('.homepage-cinematic')).toHaveCount(0);
  await expect(page.locator('header.material-bar')).toBeVisible();
});

test('populated inventory preserves photos, real API captions, availability and independent saved controls', async ({ page }) => {
  test.skip(!populated, 'Run with the isolated fixture API.');
  await page.goto('/');
  await expect(page.locator('.home-listing-card')).toHaveCount(4);
  await expect(page.locator('.home-hero-photo')).toBeVisible();
  await expect.poll(() => page.locator('.home-hero-photo').evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.home-listing-status')).toHaveText('Зарезервований');
  await expect(page.locator('.home-collections-grid a')).toHaveCount(5);
  await expect(page.locator('.home-review')).toHaveCount(3);
  await expect(page.locator('.home-stats-value').first()).toHaveText('4');
  const card = page.locator('.home-listing-card').first();
  await card.getByRole('button', { name: 'Додати в обране' }).click();
  await expect(card.getByRole('button', { name: 'Прибрати з обраного' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/$/);
  await card.getByRole('button', { name: 'Додати до порівняння' }).click();
  await expect(page.getByRole('link', { name: 'Порівняти', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Очистити', exact: true }).click();
  await card.locator('.home-listing-caption').click();
  await expect(page).toHaveURL(/\/cars\/bmw-5-series-fixture$/);
});
