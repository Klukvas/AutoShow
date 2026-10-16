import { describe, expect, it } from 'vitest';
import { COLOR_NAME_MAX, checkColorName, withColor } from './color-options';

const ref = (id: string, nameUk: string) => ({ id, slug: id, nameUk, nameEn: null });

describe('checkColorName', () => {
  it('trims and collapses whitespace', () => {
    expect(checkColorName('  Темно   зелений ')).toEqual({ ok: true, name: 'Темно зелений' });
  });
  it('rejects blank and overlong names', () => {
    expect(checkColorName('   ')).toEqual({ ok: false, reason: 'required' });
    expect(checkColorName('я'.repeat(COLOR_NAME_MAX + 1))).toEqual({
      ok: false,
      reason: 'tooLong',
    });
    expect(checkColorName('я'.repeat(COLOR_NAME_MAX)).ok).toBe(true);
  });
});

describe('withColor', () => {
  it('appends a new color without mutating the input', () => {
    const colors = [ref('red', 'Червоний')];
    const next = withColor(colors, ref('beige', 'Бежевий'));
    expect(next.map((c) => c.id)).toEqual(['red', 'beige']);
    expect(colors).toHaveLength(1);
  });
  it('does not duplicate a color the list already has', () => {
    const colors = [ref('red', 'Червоний')];
    expect(withColor(colors, ref('red', 'Червоний'))).toHaveLength(1);
  });
});
