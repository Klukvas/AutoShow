import { firstFreeSlug, ukSlug } from './uk-slug';

describe('ukSlug', () => {
  it('transliterates Ukrainian names into latin kebab case', () => {
    expect(ukSlug('Бежевий')).toBe('bezhevyi');
    expect(ukSlug('Темно-синій')).toBe('temno-synii');
    expect(ukSlug('  Перламутровий   білий ')).toBe('perlamutrovyi-bilyi');
    expect(ukSlug('Жовтий щільний')).toBe('zhovtyi-shchilnyi');
    expect(ukSlug('М’ятний')).toBe('miatnyi');
    expect(ukSlug("М'ятний")).toBe('miatnyi');
  });

  it('handles decomposed й/ї the same as precomposed ones', () => {
    const decomposed = 'Синій Їжачок'.normalize('NFD');
    expect(decomposed).not.toBe('Синій Їжачок');
    expect(ukSlug(decomposed)).toBe('synii-izhachok');
    expect(ukSlug('Синій Їжачок')).toBe('synii-izhachok');
  });

  it('keeps latin/digits, strips accents and punctuation, may return empty', () => {
    expect(ukSlug('Metallic Grey 2')).toBe('metallic-grey-2');
    expect(ukSlug('Crème')).toBe('creme');
    expect(ukSlug('!!!')).toBe('');
  });

  it('never exceeds the length limit nor ends with a dash', () => {
    const slug = ukSlug('дуже '.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('firstFreeSlug', () => {
  it('returns the base when free and suffixes -2, -3… on collision', () => {
    expect(firstFreeSlug('beige', new Set())).toBe('beige');
    expect(firstFreeSlug('beige', new Set(['beige']))).toBe('beige-2');
    expect(firstFreeSlug('beige', new Set(['beige', 'beige-2']))).toBe('beige-3');
  });

  it('trims a long base so the suffixed slug stays within the limit', () => {
    const base = 'a'.repeat(64);
    const slug = firstFreeSlug(base, new Set([base]));
    expect(slug).toBe(`${'a'.repeat(62)}-2`);
  });
});
