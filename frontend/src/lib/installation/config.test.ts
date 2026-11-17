import { describe, expect, it } from 'vitest';
import { installationSchema } from './config';

describe('installation API boundary', () => {
  const installation = {
    installationId: 'dealer-a',
    fontPreset: 'default',
    features: { reviews: true },
  };
  it('accepts the default and the minimal font preset without duplicating car contracts', () => {
    expect(installationSchema.parse(installation)).toEqual(installation);
    expect(
      installationSchema.parse({
        ...installation,
        fontPreset: 'system',
        features: { reviews: false },
      }).features.reviews,
    ).toBe(false);
  });
  it('ignores the themeId a backend still sends: the theme is fixed when the image is built', () => {
    expect(installationSchema.parse({ ...installation, themeId: 'compact' })).toEqual(installation);
  });
  it('rejects a malformed flag instead of truthy string coercion', () => {
    expect(() =>
      installationSchema.parse({ ...installation, features: { reviews: 'false' } }),
    ).toThrow();
    expect(() => installationSchema.parse({ ...installation, fontPreset: '<style>' })).toThrow();
  });
});
