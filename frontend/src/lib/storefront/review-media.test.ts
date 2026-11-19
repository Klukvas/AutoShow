import { describe, expect, it } from 'vitest';
import { reviewMedia } from './review-media';

describe('reviewMedia', () => {
  it('keeps a same-origin photo path', () => {
    expect(reviewMedia('/demo/reviews/1.jpg')).toEqual({
      kind: 'image',
      src: '/demo/reviews/1.jpg',
    });
  });

  it('recognises a YouTube or Instagram link', () => {
    expect(reviewMedia('https://www.youtube.com/watch?v=abc')).toMatchObject({
      kind: 'video',
      platform: 'youtube',
    });
    expect(reviewMedia('https://youtu.be/abc')).toMatchObject({ platform: 'youtube' });
    expect(reviewMedia('https://www.instagram.com/reel/abc/')).toMatchObject({
      kind: 'video',
      platform: 'instagram',
    });
  });

  it('drops missing, unsafe and unrelated urls', () => {
    expect(reviewMedia(null)).toBeNull();
    expect(reviewMedia('  ')).toBeNull();
    expect(reviewMedia('//evil.example/a.jpg')).toBeNull();
    expect(reviewMedia('/demo/../secret.jpg')).toBeNull();
    expect(reviewMedia('/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
    expect(reviewMedia('/%252e%252e/secret')).toBeNull();
    expect(reviewMedia('javascript:alert(1)')).toBeNull();
    expect(reviewMedia('https://evil.example/a.jpg')).toBeNull();
  });
});
