import { describe, expect, it } from 'vitest';
import { mapSearchHref, phoneHref, weeklySchedule } from './contacts-summary';

describe('phoneHref', () => {
  it('keeps only the digits and the plus of a phone typed for people', () => {
    expect(phoneHref('+38 (067) 123-45-67')).toBe('tel:+380671234567');
  });

  it('has no link without a phone', () => {
    expect(phoneHref(null)).toBeNull();
    expect(phoneHref(undefined)).toBeNull();
    expect(phoneHref('')).toBeNull();
  });
});

describe('mapSearchHref', () => {
  it('encodes the address into a Google Maps search', () => {
    expect(mapSearchHref('Київ, вул. Хрещатик 1 & 2')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Київ, вул. Хрещатик 1 & 2')}`,
    );
    expect(mapSearchHref('a b&c')).toBe(
      'https://www.google.com/maps/search/?api=1&query=a%20b%26c',
    );
  });

  it('has no link without an address', () => {
    expect(mapSearchHref(null)).toBeNull();
    expect(mapSearchHref(undefined)).toBeNull();
    expect(mapSearchHref('')).toBeNull();
  });
});

describe('weeklySchedule', () => {
  it('lists every configured day in saved order, days off included', () => {
    expect(
      weeklySchedule(
        {
          mon_fri: { open: '09:00', close: '18:00' },
          sat: { open: '10:00', close: '15:00' },
          sun: null,
        },
        'Зачинено',
      ),
    ).toEqual([
      { day: 'mon_fri', label: 'Пн–Пт', hours: '09:00 — 18:00' },
      { day: 'sat', label: 'Сб', hours: '10:00 — 15:00' },
      { day: 'sun', label: 'Нд', hours: 'Зачинено' },
    ]);
  });

  it('is empty when the showroom has no hours, so the block is not rendered', () => {
    expect(weeklySchedule(null, 'Зачинено')).toEqual([]);
    expect(weeklySchedule(undefined, 'Зачинено')).toEqual([]);
    expect(weeklySchedule({}, 'Зачинено')).toEqual([]);
  });
});
