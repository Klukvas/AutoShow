import { describe, expect, it } from 'vitest';
import { bannedWordsProblem, parseBannedWords } from './listing-ai';

describe('parseBannedWords', () => {
  it('splits on commas and new lines, trims, collapses spaces and drops case-insensitive repeats', () => {
    expect(parseBannedWords('ідеальний,\nЯк  новий, як новий ,, пам’ять сидінь')).toEqual([
      'ідеальний',
      'Як новий',
      'пам’ять сидінь',
    ]);
    expect(parseBannedWords(' , \n ')).toEqual([]);
  });
});

describe('bannedWordsProblem (mirrors the server rules)', () => {
  it('accepts words, phrases, digits, hyphens and every apostrophe form', () => {
    expect(bannedWordsProblem(["пам'ять", 'пам’ять', 'памʼять', 'як-новий', 'топ 10'])).toBeNull();
  });

  it('rejects markup, a leading hyphen, over-long words and too many words', () => {
    expect(bannedWordsProblem(['<script>'])).toMatch(/лише літери/);
    expect(bannedWordsProblem(['-ок'])).toMatch(/лише літери/);
    expect(bannedWordsProblem(['а'.repeat(41)])).toMatch(/довше за 40/);
    expect(bannedWordsProblem(Array.from({ length: 51 }, (_, i) => `слово${i}`))).toMatch(
      /Не більше 50/,
    );
  });
});
