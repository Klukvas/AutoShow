import { describe, expect, it } from 'vitest';
import { builtThemeId, verifiedThemeId } from './built-theme';

describe('built theme id', () => {
  it('is the reference theme under vitest, whatever STOREFRONT_THEME the shell exports', () => {
    expect(builtThemeId).toBe('current');
  });

  it('returns the id when the bundled folder is the requested one', () => {
    expect(verifiedThemeId('compact', 'compact')).toBe('compact');
  });

  it('fails when the bundle contains another theme than the requested one', () => {
    expect(() => verifiedThemeId('compact', 'current')).toThrow(
      'Storefront theme mismatch: STOREFRONT_THEME="compact" was requested, ' +
        'but the bundled theme folder identifies itself as "current"',
    );
  });

  it.each([undefined, ''])('fails when the id was not inlined (%j)', (requested) => {
    expect(() => verifiedThemeId(requested, 'current')).toThrow('STOREFRONT_THEME was not inlined');
  });
});
