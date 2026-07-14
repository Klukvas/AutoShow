import { test, expect } from '@playwright/test';

/**
 * Public storefront happy path. Validates the backend↔frontend contract that
 * the refactor's canonical-URL fix depends on (listings serve at /cars/[slug]).
 */
test.describe('public storefront', () => {
  test('home renders nav and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'AutoFlow', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Каталог/i }).first()).toBeVisible();
  });

  test('catalog lists cars and a card links to /cars/[slug]', async ({ page }) => {
    await page.goto('/cars');
    await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
    const firstCard = page.locator('a[href^="/cars/"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/cars\/[a-z0-9-]+$/);
  });

  test('keyword search filters the catalog, updates the URL and result count', async ({ page }) => {
    await page.goto('/cars');
    const search = page.locator('input[name="q"]').first();
    await expect(search).toBeVisible();

    // A matching term keeps at least one card and pushes q into the URL.
    await search.fill('bmw');
    await page.waitForURL(/[?&]q=bmw/);
    await expect(page.locator('a[href^="/cars/"]').first()).toBeVisible();
    // The active-filter summary chip appears with the term. The chip renders
    // twice (hidden mobile scroller + desktop row) — assert the desktop one.
    await expect(page.getByText(/Пошук:/i).last()).toBeVisible();

    // A term matching nothing → empty state (handoff 1c), zero cards.
    await search.fill('zzznope-no-match');
    await page.waitForURL(/[?&]q=zzznope/);
    await expect(page.getByText(/Нічого не знайдено/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Скинути фільтри/i })).toBeVisible();
    await expect(page.locator('a[href^="/cars/"]')).toHaveCount(0);
  });

  test('listing detail declares a canonical that matches its own URL', async ({ page }) => {
    await page.goto('/cars');
    await page.locator('a[href^="/cars/"]').first().click();
    await page.waitForURL(/\/cars\/[a-z0-9-]+$/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    // canonical must point at a /cars/ path (the sitemap/SEO fix), not /listings/
    expect(canonical).toMatch(/\/cars\//);
    expect(canonical).not.toMatch(/\/listings\//);
  });

  test('listing detail renders handoff variant A: header, panel, specs', async ({ page }) => {
    await page.goto('/cars');
    await page.locator('a[href^="/cars/"]').first().click();
    await page.waitForURL(/\/cars\/[a-z0-9-]+$/);

    // Breadcrumbs + H1 + availability badge + share.
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText('Доступний').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Поділитись/i })).toBeVisible();

    // Sticky contact panel: call CTA + trust/hours area.
    await expect(page.getByRole('link', { name: /Зателефонувати/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Записатись на тест-драйв/i })).toBeVisible();

    // Spec table + lead form live on the page.
    await expect(page.getByRole('heading', { name: 'Характеристики' })).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeAttached();
  });

  test('theme toggle flips data-theme and persists across reload', async ({ page }) => {
    await page.goto('/cars');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: /Перемкнути тему/i }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Persisted choice must survive a reload (localStorage + head script).
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: /Перемкнути тему/i }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('lead form submits and reaches a terminal state', async ({ page }) => {
    await page.goto('/contacts');
    const nameInput = page.locator('input[name="name"]');
    const phoneInput = page.locator('input[name="phone"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Тест');
    // Unique-ish phone so the per-phone limit doesn't reject a retry.
    await phoneInput.fill(`+38067${Math.floor(1000000 + Math.random() * 8999999)}`);
    // The form now starts with the lead-type segment (role=radio buttons) —
    // target the actual submit control, not the first button in the form.
    await page.locator('form').filter({ has: phoneInput }).locator('button[type="submit"]').click();
    // Either success OR the visible rate-limit notice is a valid outcome — both
    // prove the form submitted and handled the backend response. (The shared
    // localhost IP can exhaust the per-IP lead limit during a test run.)
    await expect(
      page.getByText(/прийнят|Дякуємо|звʼяж|Забагато|Спробуйте|пізніше/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
