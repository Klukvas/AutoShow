import { describe, expect, it } from 'vitest';
import { installationSchema } from './config';

describe('installation API boundary', () => {
  const current = {
    installationId: 'dealer-a',
    themeId: 'current',
    fontPreset: 'default',
    features: { reviews: true },
  };
  it('accepts default and minimal theme without duplicating car contracts', () => {
    expect(installationSchema.parse(current)).toEqual(current);
    expect(
      installationSchema.parse({
        ...current,
        themeId: 'compact',
        fontPreset: 'system',
        features: { reviews: false },
      }).features.reviews,
    ).toBe(false);
  });
  it('rejects a malformed flag instead of truthy string coercion', () => {
    expect(() =>
      installationSchema.parse({ ...current, features: { reviews: 'false' } }),
    ).toThrow();
    expect(() => installationSchema.parse({ ...current, themeId: '<style>' })).toThrow();
  });
});
