import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@autoflow.example';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Demo!Password12345';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Увійти/i }).click();
  await page.waitForURL('**/admin/listings');
}

test.describe('admin panel', () => {
  test('login lands on the listings dashboard', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /Обʼяви/i })).toBeVisible();
    // admin sees the full sidebar (team/branding/audit)
    await expect(page.getByRole('link', { name: /Команда/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Брендинг/i })).toBeVisible();
  });

  test('create a listing through the form → lands on its draft detail', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /Нова обʼява/i }).click();
    await page.waitForURL('**/admin/listings/new');

    await page.locator('select[name="makeId"]').selectOption({ label: 'BMW' });
    await page.locator('select[name="modelId"]').selectOption({ label: 'X5' });
    await page.locator('input[name="mileageKm"]').fill('12000');
    await page.locator('input[name="engineVolumeL"]').fill('3');
    await page.locator('input[name="powerHp"]').fill('340');
    await page.locator('select[name="bodyTypeId"]').selectOption({ index: 1 });
    await page.locator('select[name="fuelTypeId"]').selectOption({ index: 1 });
    await page.locator('select[name="transmissionId"]').selectOption({ index: 1 });
    await page.locator('select[name="driveTypeId"]').selectOption({ index: 1 });
    await page.locator('select[name="colorId"]').selectOption({ index: 1 });
    await page.locator('input[name="priceAmount"]').fill('72000');
    await page.locator('input[name="title"]').fill('E2E BMW X5 test listing');
    await page
      .locator('textarea[name="description"]')
      .fill('Опис для e2e перевірки, достатньої довжини для валідатора.');
    await page.locator('input[name="locationCity"]').fill('Київ');

    await page.getByRole('button', { name: /Створити обʼяву/i }).click();
    await page.waitForURL(/\/admin\/listings\/[0-9a-f-]{36}$/);
    await expect(page.getByText('DRAFT')).toBeVisible();
    await expect(page.getByRole('link', { name: /Редагувати/i })).toBeVisible();
  });

  test('edit the just-created listing → version bumps', async ({ page }) => {
    await login(page);
    // open a real listing row (exclude the "+ Нова обʼява" → /new CTA)
    await page.locator('a[href^="/admin/listings/"]:not([href$="/new"])').first().click();
    await page.waitForURL(/\/admin\/listings\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: /Редагувати/i }).click();
    await page.waitForURL(/\/admin\/listings\/[0-9a-f-]{36}\/edit$/);

    await page.locator('input[name="priceAmount"]').fill('68000');
    await page.getByRole('button', { name: /Зберегти зміни/i }).click();
    await page.waitForURL(/\/admin\/listings\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/version 2/i)).toBeVisible();
  });
});
