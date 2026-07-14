import { test, expect } from '@playwright/test';

// Mobile viewport (iPhone-ish). Guards the responsive nav that replaced the
// desktop-only header links.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('mobile navigation', () => {
  test('desktop nav links are hidden; hamburger opens an opaque menu that navigates', async ({
    page,
  }) => {
    await page.goto('/');

    // The inline desktop nav links must not be visible at this width.
    const primaryNav = page.getByRole('navigation', { name: 'Primary' });
    await expect(primaryNav).toBeHidden();

    // Open the mobile menu.
    await page.getByRole('button', { name: /Відкрити меню/i }).click();
    const menu = page.getByRole('navigation', { name: 'Mobile' });
    await expect(menu).toBeVisible();

    // Tapping a link navigates and closes the menu.
    await menu.getByRole('link', { name: /Каталог/i }).click();
    await expect(page).toHaveURL(/\/cars$/);
    await expect(menu).toBeHidden();
  });
});

test.describe('mobile catalog (handoff 1b)', () => {
  test('filter sheet opens, shows the sticky apply button and closes', async ({ page }) => {
    await page.goto('/cars');

    // Full-width search + the black "Фільтри" button are the mobile controls.
    await expect(page.locator('input[name="q"]').last()).toBeVisible();
    await page.getByRole('button', { name: /Фільтри/i }).click();

    const sheet = page.getByRole('dialog', { name: /Фільтри/i });
    await expect(sheet).toBeVisible();
    // Sticky apply button shows the live result count wording.
    await expect(sheet.getByRole('button', { name: /Показати/i })).toBeVisible();

    await sheet.getByRole('button', { name: /Показати/i }).click();
    await expect(sheet).toBeHidden();
  });
});

test.describe('mobile listing detail (handoff 1g)', () => {
  test('sticky bottom CTA bar is visible; desktop contact panel is not', async ({ page }) => {
    await page.goto('/cars');
    await page.locator('a[href^="/cars/"]').first().click();
    await page.waitForURL(/\/cars\/[a-z0-9-]+$/);

    // Bottom bar: call icon link + full-width lead CTA.
    await expect(page.getByRole('link', { name: /Зателефонувати/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Залишити заявку/i }).last()).toBeVisible();

    // The desktop test-drive ghost CTA lives in the hidden sticky panel.
    await expect(page.getByRole('button', { name: /Записатись на тест-драйв/i })).toBeHidden();
  });
});
