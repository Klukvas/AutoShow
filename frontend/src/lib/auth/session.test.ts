import { afterEach, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it('expires the same domain and path that were used when setting the session', async () => {
  vi.stubEnv('ADMIN_COOKIE_DOMAIN', '.example.test');
  const { clearSession } = await import('./session');
  await clearSession();
  expect(store.set).toHaveBeenCalledWith(
    'autoflow_admin',
    '',
    expect.objectContaining({
      domain: '.example.test',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
    }),
  );
});
