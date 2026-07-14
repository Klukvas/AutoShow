import { describe, expect, it } from 'vitest';
import { presentAuditAction, shortId, sliceByPeriod } from './audit-format';

const NOW = new Date('2026-07-13T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();

describe('audit formatting', () => {
  it('maps known actions and falls back for unknown ones', () => {
    expect(presentAuditAction('listing.publish').labelKey).toBe('listing_publish');
    expect(presentAuditAction('listing.mark-sold').tone).toBe('danger');
    expect(presentAuditAction('something.new').labelKey).toBe('fallback');
  });

  it('shortens entity ids', () => {
    expect(shortId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('#a1b2c3d4');
    expect(shortId(null)).toBe('');
  });

  it('slices a DESC page at the period boundary and flags truncation', () => {
    const rows = [
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(6) },
      { createdAt: daysAgo(9) },
      { createdAt: daysAgo(12) },
    ];
    const week = sliceByPeriod(rows, '7', NOW);
    expect(week.items).toHaveLength(2);
    expect(week.truncated).toBe(true);

    const month = sliceByPeriod(rows, '30', NOW);
    expect(month.items).toHaveLength(4);
    expect(month.truncated).toBe(false);

    const all = sliceByPeriod(rows, 'all', NOW);
    expect(all.items).toHaveLength(4);
    expect(all.truncated).toBe(false);
  });
});
