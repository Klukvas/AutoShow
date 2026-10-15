import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('nested overlays retain the lock and restore the original overflow', async () => {
  const document = { body: { style: { overflow: 'clip' } }, documentElement: { dataset: {} } };
  vi.stubGlobal('document', document);
  const { lockBodyScroll, unlockBodyScroll } = await import('./scroll-lock');
  lockBodyScroll();
  lockBodyScroll();
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.documentElement.dataset).toHaveProperty('scrollLocked');
  unlockBodyScroll();
  expect(document.body.style.overflow).toBe('hidden');
  unlockBodyScroll();
  expect(document.body.style.overflow).toBe('clip');
  expect(document.documentElement.dataset).not.toHaveProperty('scrollLocked');
});
