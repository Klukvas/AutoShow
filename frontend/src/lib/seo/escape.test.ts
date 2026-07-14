import { describe, it, expect } from 'vitest';
import { safeJsonLd } from './escape';

describe('safeJsonLd (JSON-LD XSS hardening)', () => {
  it('escapes a </script> breakout attempt in a value', () => {
    const out = safeJsonLd({ name: 'Car</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script\\u003e');
  });

  it('escapes <, > and & everywhere', () => {
    const out = safeJsonLd({ a: '<', b: '>', c: '&' });
    expect(out).not.toMatch(/[<>&]/);
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
    expect(out).toContain('\\u0026');
  });

  it('round-trips back to the original object after unescaping', () => {
    const data = { name: 'BMW <X5> & "quotes"', year: 2026 };
    const parsed = JSON.parse(safeJsonLd(data));
    expect(parsed).toEqual(data);
  });

  it('leaves safe content untouched', () => {
    expect(safeJsonLd({ name: 'Audi A6' })).toBe('{"name":"Audi A6"}');
  });
});
