import { describe, expect, it } from 'vitest';
import uk from '../../messages/uk.json';
import ru from '../../messages/ru.json';
import en from '../../messages/en.json';
import { intlLocale } from './intl';
import { resolveLocale } from './locales';

function leaves(value: unknown, path: string, out: Map<string, string>) {
  if (typeof value === 'string') {
    out.set(path, value);
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      leaves(child, path ? `${path}.${key}` : key, out);
    }
  }
}

/** ICU variable names, including the counter in `{count, plural, ...}`. */
function variables(message: string): string[] {
  return [...message.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]).sort();
}

describe('resolveLocale', () => {
  it('keeps Ukrainian as the default', () => {
    expect(resolveLocale(undefined)).toBe('uk');
    expect(resolveLocale('')).toBe('uk');
    expect(resolveLocale('de')).toBe('uk');
  });

  it('accepts the shipped locales', () => {
    expect(resolveLocale('uk')).toBe('uk');
    expect(resolveLocale('ru')).toBe('ru');
    expect(resolveLocale('en')).toBe('en');
  });
});

describe('intlLocale', () => {
  it('maps app locales onto Intl tags', () => {
    expect(intlLocale('uk')).toBe('uk-UA');
    expect(intlLocale('ru')).toBe('ru-RU');
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('nope')).toBe('uk-UA');
  });
});

describe('message catalogs', () => {
  const ukLeaves = new Map<string, string>();
  const ruLeaves = new Map<string, string>();
  const enLeaves = new Map<string, string>();
  leaves(uk, '', ukLeaves);
  leaves(ru, '', ruLeaves);
  leaves(en, '', enLeaves);

  it('keeps the same keys in Ukrainian, Russian and English', () => {
    expect([...ruLeaves.keys()].sort()).toEqual([...ukLeaves.keys()].sort());
    expect([...enLeaves.keys()].sort()).toEqual([...ukLeaves.keys()].sort());
  });

  it('keeps the same ICU variables in every locale', () => {
    for (const key of ukLeaves.keys()) {
      expect(variables(ruLeaves.get(key) ?? ''), key).toEqual(variables(ukLeaves.get(key) ?? ''));
      expect(variables(enLeaves.get(key) ?? ''), key).toEqual(variables(ukLeaves.get(key) ?? ''));
    }
  });

  it('has no empty strings', () => {
    for (const [key, value] of [...ruLeaves, ...enLeaves]) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});
