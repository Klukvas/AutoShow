import { describe, expect, it } from 'vitest';
import { catalogLabel } from './catalog-label';

const sedan = { nameUk: 'Седан', nameEn: 'Sedan' };
const unnamed = { nameUk: 'Купе', nameEn: null };

describe('catalogLabel', () => {
  it('keeps the Ukrainian name by default and for Russian', () => {
    expect(catalogLabel(sedan)).toBe('Седан');
    expect(catalogLabel(sedan, 'uk')).toBe('Седан');
    expect(catalogLabel(sedan, 'ru')).toBe('Седан');
  });

  it('uses the English name when the directory has one', () => {
    expect(catalogLabel(sedan, 'en')).toBe('Sedan');
    expect(catalogLabel(unnamed, 'en')).toBe('Купе');
    expect(catalogLabel(null, 'en')).toBe('');
  });
});
