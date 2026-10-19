import { describe, expect, it } from 'vitest';
import {
  bannedWordsProblem,
  draftAttempt,
  isDraftRunning,
  parseBannedWords,
  relevantFlags,
} from './listing-ai';

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

describe('draft helpers', () => {
  const flag = (field: 'description' | 'metaTitle' | 'metaDescription' | null) => ({
    reason: 'mismatch' as const,
    claim: 'x',
    sourceField: 'year',
    field,
  });

  it('asks to confirm only flags on the taken texts, plus whole-draft flags', () => {
    const draft = { flags: [flag('metaDescription'), flag(null), flag('description')] };
    expect(relevantFlags(draft, ['metaTitle']).map((f) => f.field)).toEqual([null]);
    expect(relevantFlags(draft, ['metaDescription']).map((f) => f.field)).toEqual([
      'metaDescription',
      null,
    ]);
    expect(relevantFlags({ flags: [flag('metaTitle')] }, ['description'])).toEqual([]);
  });

  it('reuses the request id for a retry of the same preset only', () => {
    const first = draftAttempt(null, 'standard', () => 'r1');
    expect(draftAttempt(first, 'standard', () => 'r2')).toBe(first);
    expect(draftAttempt(first, 'short', () => 'r3')).toEqual({ requestId: 'r3', preset: 'short' });
  });

  it('treats queued and processing as running', () => {
    expect(isDraftRunning({ status: 'queued' })).toBe(true);
    expect(isDraftRunning({ status: 'processing' })).toBe(true);
    expect(isDraftRunning({ status: 'ready' })).toBe(false);
  });
});
