import { describe, expect, it } from 'vitest';
import { deriveHoverHex, isValidHex, normalizeHex } from './derive-hover';

describe('accent hover derivation', () => {
  it('validates hex', () => {
    expect(isValidHex('#2E53E6')).toBe(true);
    expect(isValidHex('#fff')).toBe(true);
    expect(isValidHex('2E53E6')).toBe(false);
    expect(isValidHex('#12345')).toBe(false);
  });

  it('normalizes 3-digit hex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
  });

  it('derives a darker same-format hex', () => {
    const hover = deriveHoverHex('#2E53E6');
    expect(hover).toMatch(/^#[0-9A-F]{6}$/);
    // Darker = smaller summed channel value.
    const sum = (hex: string) =>
      hex
        .slice(1)
        .match(/../g)!
        .reduce((acc, ch) => acc + parseInt(ch, 16), 0);
    expect(sum(hover)).toBeLessThan(sum('#2E53E6'));
  });

  it('passes invalid input through untouched', () => {
    expect(deriveHoverHex('nope')).toBe('nope');
  });
});
