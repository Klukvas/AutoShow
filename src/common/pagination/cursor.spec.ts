import { decodeCursor, encodeCursor } from './cursor';

describe('cursor utility', () => {
  it('round-trips payload through encode/decode', () => {
    const payload = { k: '2026-06-01T00:00:00.000Z', i: 'abc-123' };
    const encoded = encodeCursor(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(payload);
  });

  it('returns null for malformed cursor', () => {
    expect(decodeCursor('not_base64!')).toBeNull();
    expect(decodeCursor(Buffer.from('not json').toString('base64url'))).toBeNull();
  });
});
