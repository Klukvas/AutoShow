import { describe, expect, it } from 'vitest';
import { storefrontHttpUrl } from './http-url';

describe('storefrontHttpUrl', () => {
  it('keeps http and https links', () => {
    expect(storefrontHttpUrl('https://t.me/dealer')).toBe('https://t.me/dealer');
    expect(storefrontHttpUrl('  http://t.me/dealer  ')).toBe('http://t.me/dealer');
  });

  it('drops empty and non-http values', () => {
    expect(storefrontHttpUrl(null)).toBeNull();
    expect(storefrontHttpUrl(undefined)).toBeNull();
    expect(storefrontHttpUrl('')).toBeNull();
    expect(storefrontHttpUrl('   ')).toBeNull();
    expect(storefrontHttpUrl('javascript:alert(1)')).toBeNull();
    expect(storefrontHttpUrl('telegram')).toBeNull();
  });
});
