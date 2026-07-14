import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, moveItem, validateFile } from './media-types';

describe('media validation', () => {
  it('accepts the handoff formats', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']) {
      expect(validateFile({ name: 'f', type, size: 1000 })).toBeNull();
    }
  });

  it('rejects unsupported types', () => {
    expect(validateFile({ name: 'x.gif', type: 'image/gif', size: 10 })).toEqual({
      name: 'x.gif',
      reason: 'type',
    });
  });

  it('rejects oversized files (>20 МБ)', () => {
    expect(validateFile({ name: 'big.mp4', type: 'video/mp4', size: MAX_FILE_BYTES + 1 })).toEqual({
      name: 'big.mp4',
      reason: 'size',
    });
    expect(validateFile({ name: 'ok.mp4', type: 'video/mp4', size: MAX_FILE_BYTES })).toBeNull();
  });
});

describe('moveItem', () => {
  it('moves forward and backward immutably', () => {
    const src = ['a', 'b', 'c', 'd'];
    expect(moveItem(src, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(src, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clamps out-of-range targets', () => {
    expect(moveItem(['a', 'b'], 0, 99)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 1, -5)).toEqual(['b', 'a']);
  });
});
