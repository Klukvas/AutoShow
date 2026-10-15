import { test, expect } from '@playwright/test';
import path from 'node:path';

const origin = 'http://127.0.0.1:4321';
const proof = path.resolve(__dirname, '../../.catalog-release');
const image = {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOz8AAAAASUVORK5CYII=',
    'base64',
  ),
};

test.beforeEach(async ({ page, request }) => {
  await request.post(`${origin}/__fixture/reset`);
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.origin === origin || url.protocol === 'blob:'
      ? route.continue()
      : route.abort('blockedbyclient');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('dictionary desktop: visible editing, model counts, replace/remove logo and guarded deletion', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/catalog`);
  await expect(page.getByRole('heading', { name: 'Марки та моделі', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Редагувати марку: BMW' })).toBeVisible();
  await page.getByRole('button', { name: 'BMW Моделей: 2' }).click();
  await expect(page.getByRole('button', { name: 'Редагувати модель: X3' })).toBeVisible();
  await page.screenshot({ path: path.join(proof, 'catalog-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Редагувати марку: BMW' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Назва марки').fill('BMW Motors');
  await dialog
    .getByLabel('Замінити логотип', { exact: true })
    .setInputFiles({ ...image, buffer: await (await request.get(`${origin}/logo.png`)).body() });
  await expect(dialog.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: path.join(proof, 'catalog-logo-preview.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Редагувати марку: BMW Motors' }).click();
  await dialog.getByRole('button', { name: 'Прибрати логотип' }).click();
  await expect(dialog.getByText('Без логотипа — показуватиметься літера')).toBeVisible();
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Редагувати марку: BMW Motors' }).click();
  await expect(dialog.getByText('Без логотипа — показуватиметься літера')).toBeVisible();
  await dialog.getByRole('button', { name: 'Скасувати' }).click();
  await page.getByRole('button', { name: 'BMW Motors Моделей: 2' }).click();
  await page.getByRole('button', { name: 'Видалити марку', exact: true }).click();
  await dialog.getByRole('button', { name: 'Так, видалити' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Марка використовується моделями');
});

test('create make upload failure retries same make; shared model edit and editor controls', async ({
  page,
  request,
}) => {
  await page.goto(`${origin}/catalog?role=editor`);
  await page.getByRole('button', { name: '+ Додати марку', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Назва марки').fill('Polestar');
  await dialog.getByLabel('Завантажити логотип', { exact: true }).setInputFiles(image);
  await request.post(`${origin}/__fixture/fail-upload`);
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Марку вже створено');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(dialog).toBeHidden();
  const state = await (await request.get(`${origin}/__fixture/state`)).json();
  expect(state.makes.filter((make: { nameUk: string }) => make.nameUk === 'Polestar')).toHaveLength(
    1,
  );
  expect(
    state.calls.filter(
      (call: { method: string; path: string }) =>
        call.method === 'POST' && call.path === '/api/admin/catalog/makes',
    ),
  ).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Видалити марку', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Додати модель', exact: true }).click();
  await dialog.getByLabel('Назва моделі').fill('2');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await page.getByRole('button', { name: 'Редагувати модель: 2', exact: true }).click();
  await dialog.getByLabel('Назва моделі').fill('Two');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Редагувати модель: Two', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Видалити/ })).toHaveCount(0);
});

test('listing persistent creation opens shared forms, selects results, and resets model after make switch', async ({
  page,
  request,
}) => {
  await page.goto(`${origin}/listing?role=editor`);
  await page.getByRole('button', { name: '+ Додати марку', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Завантажити логотип', { exact: true })).toBeVisible();
  await dialog.getByLabel('Назва марки').fill('Lucid');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('combobox').first()).toHaveValue('Lucid');
  await page.getByRole('button', { name: '+ Додати модель', exact: true }).click();
  await dialog.getByLabel('Назва моделі').fill('Air');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('Air');
  const state = await (await request.get(`${origin}/__fixture/state`)).json();
  const make = state.makes.find((make: { nameUk: string }) => make.nameUk === 'Lucid');
  expect(await page.locator('input[name="makeId"]').inputValue()).toBe(make.id);
  await page.getByRole('combobox').first().fill('BMW');
  await page.getByRole('option', { name: 'BMW', exact: true }).click();
  await expect(page.locator('input[name="modelId"]')).toHaveValue('');
  await page.getByRole('combobox').first().fill('Rivian');
  await page.getByRole('button', { name: /Створити марку/ }).click();
  await expect(dialog.getByLabel('Назва марки')).toHaveValue('Rivian');
  await expect(dialog.getByLabel('Завантажити логотип', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Скасувати' }).click();
});

test('mobile: visible actions, focus containment, invalid file, cancel preserves image', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/catalog?role=editor`);
  await page.getByRole('button', { name: 'Редагувати марку: BMW' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Замінити логотип', { exact: true })
    .setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(dialog.getByRole('alert')).toContainText('Оберіть PNG');
  await dialog
    .getByLabel('Замінити логотип', { exact: true })
    .setInputFiles({ ...image, buffer: await (await request.get(`${origin}/logo.png`)).body() });
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: path.join(proof, 'catalog-mobile-dialog.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Скасувати' }).click();
  const state = await (await request.get(`${origin}/__fixture/state`)).json();
  expect(state.makes[0].logoUrl).toBe('/logo.png');
  expect(state.calls.filter((call: { method: string }) => call.method !== 'GET')).toHaveLength(0);
  await page.screenshot({ path: path.join(proof, 'catalog-mobile.png'), fullPage: true });
});

test('listing failed logo upload then cancel keeps persisted make available without reload', async ({
  page,
  request,
}) => {
  await page.goto(`${origin}/listing?role=editor`);
  await page.getByRole('button', { name: '+ Додати марку', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Назва марки').fill('Zeekr');
  await dialog.getByLabel('Завантажити логотип', { exact: true }).setInputFiles(image);
  await request.post(`${origin}/__fixture/fail-upload`);
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Марку вже створено');
  await dialog.getByRole('button', { name: 'Скасувати' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('combobox').first()).toHaveValue('Zeekr');
  await page.getByRole('combobox').first().fill('Zeekr');
  await expect(page.getByRole('option', { name: 'Zeekr', exact: true })).toBeVisible();
  const state = await (await request.get(`${origin}/__fixture/state`)).json();
  expect(state.makes.filter((make: { nameUk: string }) => make.nameUk === 'Zeekr')).toHaveLength(1);
});

test('light mobile dialog stays opaque and upload has visible keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/catalog?role=editor`);
  await page.getByRole('button', { name: 'Тема', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Редагувати марку: BMW' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const input = dialog.getByLabel('Замінити логотип', { exact: true });
  await input.focus();
  await expect(input).toBeFocused();
  const label = input.locator('..');
  await expect(label).not.toHaveCSS('box-shadow', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(proof, 'catalog-mobile-light.png'), fullPage: true });
});

test('dictionary refresh supersedes inline cached names/logos/models and removes deleted entries', async ({
  page,
  request,
}) => {
  await page.goto(`${origin}/listing?role=editor`);
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: '+ Додати марку', exact: true }).click();
  await dialog.getByLabel('Назва марки').fill('Nio');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('combobox').first()).toHaveValue('Nio');
  await page.getByRole('button', { name: '+ Додати модель', exact: true }).click();
  await dialog.getByLabel('Назва моделі').fill('ET5');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('ET5');
  const state = await (await request.get(`${origin}/__fixture/state`)).json();
  const make = state.makes.find((make: { nameUk: string }) => make.nameUk === 'Nio');
  const model = state.models.find((model: { nameUk: string }) => model.nameUk === 'ET5');
  await request.patch(`${origin}/api/admin/catalog/makes/${make.id}`, {
    data: { nameUk: 'NIO Motors', slug: make.slug },
  });
  await request.post(`${origin}/api/admin/catalog/makes/${make.id}/logo`, {
    multipart: { file: { name: image.name, mimeType: image.mimeType, buffer: image.buffer } },
  });
  await request.patch(`${origin}/api/admin/catalog/models/${model.id}`, {
    data: { nameUk: 'ET5 Touring', slug: model.slug, makeId: make.id },
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('combobox').first()).toHaveValue('NIO Motors');
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('ET5 Touring');
  await expect(page.locator('input[name="makeId"]').locator('..').locator('img')).toHaveAttribute(
    'src',
    /logo.png\?v=/,
  );
  await request.delete(`${origin}/api/admin/catalog/models/${model.id}`);
  await request.delete(`${origin}/api/admin/catalog/makes/${make.id}`);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('input[name="makeId"]')).toHaveValue('');
  await expect(page.locator('input[name="modelId"]')).toHaveValue('');
  await page.getByRole('combobox').first().fill('NIO');
  await expect(page.getByRole('option', { name: 'NIO Motors', exact: true })).toHaveCount(0);
});

test('catalog read started before inline create cannot erase the created selection', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route(`${origin}/api/admin/catalog/makes`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto(`${origin}/listing?role=editor`);
  await ready;
  await page.getByRole('button', { name: '+ Додати марку', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Назва марки').fill('Avatr');
  await dialog.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('combobox').first()).toHaveValue('Avatr');
  release();
  await expect(page.getByRole('combobox').first()).toHaveValue('Avatr');
  await page.getByRole('combobox').first().fill('Avatr');
  await expect(page.getByRole('option', { name: 'Avatr', exact: true })).toBeVisible();
});
