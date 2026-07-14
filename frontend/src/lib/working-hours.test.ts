import { describe, it, expect } from 'vitest';
import { dayLabel } from './working-hours';

describe('dayLabel', () => {
  it('maps known machine keys to Ukrainian labels', () => {
    expect(dayLabel('mon_fri')).toBe('Пн–Пт');
    expect(dayLabel('sat')).toBe('Сб');
    expect(dayLabel('SUN')).toBe('Нд');
  });

  it('falls back to a de-underscored key for unknown values', () => {
    expect(dayLabel('some_custom_slot')).toBe('some custom slot');
  });
});
