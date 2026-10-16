import { describe, expect, it } from 'vitest';
import { isSafePaymentUrl, photoBalanceNotice, type PhotoPackOverview } from './photo-packs';

const managed = (available: number, isLow: boolean, isEmpty: boolean): PhotoPackOverview => ({
  mode: 'managed',
  packSize: 50,
  packPriceUah: 300,
  balance: { credited: available, reserved: 0, consumed: 0, available },
  isLow,
  isEmpty,
  invoices: [],
});

describe('photoBalanceNotice', () => {
  it('warns when low and errors when empty', () => {
    expect(photoBalanceNotice(managed(4, true, false))).toEqual({ tone: 'warning', kind: 'low' });
    expect(photoBalanceNotice(managed(0, false, true))).toEqual({ tone: 'error', kind: 'empty' });
    expect(photoBalanceNotice(managed(-3, false, true))).toEqual({ tone: 'error', kind: 'empty' });
  });

  it('shows nothing with enough photos, in own_key mode, or before loading', () => {
    expect(photoBalanceNotice(managed(40, false, false))).toBeNull();
    expect(photoBalanceNotice({ mode: 'own_key' })).toBeNull();
    expect(photoBalanceNotice(undefined)).toBeNull();
  });
});

describe('isSafePaymentUrl', () => {
  it('accepts only https payment pages', () => {
    expect(isSafePaymentUrl('https://pay.monobank.ua/abc')).toBe(true);
    expect(isSafePaymentUrl('javascript:alert(1)')).toBe(false);
    expect(isSafePaymentUrl('http://pay.monobank.ua/abc')).toBe(false);
    expect(isSafePaymentUrl('not a url')).toBe(false);
  });
});
