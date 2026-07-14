import { describe, expect, it } from 'vitest';
import { formatRelativeDateTime, formatRelativeDay } from './relative-date';

const LABELS = { today: 'Сьогодні', yesterday: 'Вчора' };
const NOW = new Date('2026-07-13T15:00:00');

describe('relative dates', () => {
  it('same day → time only', () => {
    expect(formatRelativeDay('2026-07-13T14:32:00', LABELS, 'uk-UA', NOW)).toBe('14:32');
  });

  it('yesterday → label', () => {
    expect(formatRelativeDay('2026-07-12T10:00:00', LABELS, 'uk-UA', NOW)).toBe('Вчора');
  });

  it('older → short date', () => {
    const out = formatRelativeDay('2026-07-01T10:00:00', LABELS, 'uk-UA', NOW);
    expect(out).toMatch(/1/);
    expect(out).not.toBe('Вчора');
  });

  it('detail form prefixes the day label', () => {
    expect(formatRelativeDateTime('2026-07-13T14:32:00', LABELS, 'uk-UA', NOW)).toBe(
      'Сьогодні, 14:32',
    );
    expect(formatRelativeDateTime('2026-07-12T09:05:00', LABELS, 'uk-UA', NOW)).toBe(
      'Вчора, 09:05',
    );
  });

  it('handles invalid input', () => {
    expect(formatRelativeDay('garbage', LABELS, 'uk-UA', NOW)).toBe('—');
  });
});
