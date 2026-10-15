import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

test.skip(!process.env.AUDIT_APP_URL, 'Opt in to the isolated real Next app fixture');
test('real admin dashboard layout supplies QueryClient to branding and photo workspace', async ({
  page,
  context,
}) => {
  const origin = process.env.AUDIT_APP_URL ?? '';
  const now = Math.floor(Date.now() / 1000);
  const session = {
    accessToken: 'fixture-access',
    refreshToken: 'fixture-refresh',
    accessExpiresAt: now + 900,
    refreshExpiresAt: now + 3600,
    user: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: 'fixture@test.local',
      role: 'admin',
    },
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', 'audit-fixture-signing-key')
    .update(payload)
    .digest('base64url');
  await context.addCookies([
    {
      name: 'autoflow_admin',
      value: `${payload}.${signature}`,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/admin/branding`);
  await expect(
    page.getByRole('button', { name: 'Зберегти налаштування ШІ', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('API-ключ OpenAI', { exact: true })).toBeVisible();
  await page.goto(`${origin}/admin/listings/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/edit`);
  await page.getByRole('button', { name: 'Редагувати з ШІ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Редагування фото з ШІ' })).toBeVisible();
  await expect(page.getByText('Обробка ШІ поки недоступна.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
