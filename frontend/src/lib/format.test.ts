import { describe, it, expect } from 'vitest';
import { formatMoney, formatMileage, formatEngineVolume, formatYear } from './format';

// The formatters use typographic (narrow no-break) spaces on purpose; these
// tests assert the digits/grouping/glyph, not the exact whitespace codepoint.
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('groups thousands and prepends the currency glyph', () => {
    expect(norm(formatMoney('38500.00', 'USD'))).toBe('$ 38 500');
    expect(norm(formatMoney(69900, 'EUR'))).toBe('€ 69 900');
    expect(norm(formatMoney(1200000, 'UAH'))).toBe('₴ 1 200 000');
  });

  it('handles a stringified integer amount from the backend', () => {
    expect(norm(formatMoney('50000.00', 'USD'))).toBe('$ 50 000');
  });

  it('returns an em dash for non-numeric input', () => {
    expect(formatMoney('not-a-number', 'USD')).toBe('—');
  });
});

describe('formatMileage', () => {
  it('renders thousands as "тис. км"', () => {
    expect(norm(formatMileage(42000))).toBe('42 тис. км');
  });
  it('renders small values in km', () => {
    expect(norm(formatMileage(800))).toBe('800 км');
  });
});

describe('formatEngineVolume / formatYear', () => {
  it('trims a trailing .0 and appends л', () => {
    expect(norm(formatEngineVolume('2.0'))).toBe('2 л');
    expect(norm(formatEngineVolume('3.5'))).toBe('3.5 л');
  });
  it('formats the year as a plain string', () => {
    expect(formatYear(2026)).toBe('2026');
  });
});
