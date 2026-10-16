import {
  addMonthsUtc,
  computeBillingState,
  DAY_MS,
  extendPaidUntil,
  grantedPeriod,
  rollbackPaidUntil,
} from './billing-state';

const terms = { remindDays: 7, graceDays: 10 };
const paidUntil = new Date('2026-11-01T00:00:00.000Z');
const at = (offsetMs: number) => new Date(paidUntil.getTime() + offsetMs);

describe('computeBillingState', () => {
  it('is active more than REMIND_DAYS before paid_until', () => {
    const s = computeBillingState(paidUntil, at(-7 * DAY_MS - 1), terms);
    expect(s.state).toBe('active');
    expect(s.daysLeft).toBe(8);
  });

  it('becomes due_soon exactly REMIND_DAYS before paid_until', () => {
    const s = computeBillingState(paidUntil, at(-7 * DAY_MS), terms);
    expect(s.state).toBe('due_soon');
    expect(s.daysLeft).toBe(7);
  });

  it('stays due_soon until the last millisecond of the paid period', () => {
    const s = computeBillingState(paidUntil, at(-1), terms);
    expect(s.state).toBe('due_soon');
    expect(s.daysLeft).toBe(1);
  });

  it('is overdue exactly at paid_until', () => {
    const s = computeBillingState(paidUntil, paidUntil, terms);
    expect(s.state).toBe('overdue');
    expect(s.daysLeft).toBe(0);
    expect(s.daysUntilBlock).toBe(10);
  });

  it('stays overdue until the last millisecond of the grace period', () => {
    const s = computeBillingState(paidUntil, at(10 * DAY_MS - 1), terms);
    expect(s.state).toBe('overdue');
    expect(s.daysUntilBlock).toBe(1);
  });

  it('is blocked exactly GRACE_DAYS after paid_until and later', () => {
    expect(computeBillingState(paidUntil, at(10 * DAY_MS), terms).state).toBe('blocked');
    const later = computeBillingState(paidUntil, at(40 * DAY_MS), terms);
    expect(later.state).toBe('blocked');
    expect(later.daysUntilBlock).toBe(0);
    expect(later.daysLeft).toBe(-40);
  });

  it('exposes blockAt = paid_until + GRACE_DAYS', () => {
    const s = computeBillingState(paidUntil, paidUntil, terms);
    expect(s.blockAt.toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });

  it('blocks immediately at paid_until when there is no grace period', () => {
    const s = computeBillingState(paidUntil, paidUntil, { remindDays: 0, graceDays: 0 });
    expect(s.state).toBe('blocked');
    expect(computeBillingState(paidUntil, at(-1), { remindDays: 0, graceDays: 0 }).state).toBe(
      'active',
    );
  });

  it('depends on instants only, not on the offset the dates were written in', () => {
    const kyiv = new Date('2026-11-01T02:00:00+02:00'); // same instant as paidUntil
    const nowUtc = new Date('2026-10-25T00:00:00Z');
    const nowKyiv = new Date('2026-10-25T03:00:00+03:00');
    expect(computeBillingState(kyiv, nowKyiv, terms)).toEqual(
      computeBillingState(paidUntil, nowUtc, terms),
    );
    expect(computeBillingState(kyiv, nowKyiv, terms).state).toBe('due_soon');
  });
});

describe('addMonthsUtc', () => {
  it('keeps the day and time of day', () => {
    expect(addMonthsUtc(new Date('2026-03-15T10:20:30.000Z'), 1).toISOString()).toBe(
      '2026-04-15T10:20:30.000Z',
    );
  });

  it('clamps to the end of a shorter month (incl. leap years)', () => {
    expect(addMonthsUtc(new Date('2026-01-31T12:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T12:00:00.000Z',
    );
    expect(addMonthsUtc(new Date('2028-01-31T12:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T12:00:00.000Z',
    );
  });

  it('rolls over the year', () => {
    expect(addMonthsUtc(new Date('2026-11-30T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });
});

describe('extendPaidUntil', () => {
  const now = new Date('2026-10-16T09:00:00Z');

  it('extends from paid_until when paying early', () => {
    expect(extendPaidUntil(new Date('2026-10-20T00:00:00Z'), 1, now).toISOString()).toBe(
      '2026-11-20T00:00:00.000Z',
    );
  });

  it('extends from paid_until while overdue if the result is still in the future', () => {
    expect(extendPaidUntil(new Date('2026-10-10T00:00:00Z'), 1, now).toISOString()).toBe(
      '2026-11-10T00:00:00.000Z',
    );
  });

  it('restarts from now when the extension would still be in the past', () => {
    expect(extendPaidUntil(new Date('2026-06-01T00:00:00Z'), 1, now).toISOString()).toBe(
      '2026-11-16T09:00:00.000Z',
    );
  });

  it('restarts from now when the extension lands exactly on now', () => {
    expect(extendPaidUntil(new Date('2026-09-16T09:00:00Z'), 1, now).toISOString()).toBe(
      '2026-11-16T09:00:00.000Z',
    );
  });
});

describe('rollbackPaidUntil', () => {
  it('subtracts the stored credited duration', () => {
    const credit = {
      creditedFrom: new Date('2026-10-20T00:00:00Z'),
      creditedUntil: new Date('2026-11-20T00:00:00Z'),
      periodMonths: 1,
    };
    expect(rollbackPaidUntil(new Date('2026-12-20T00:00:00Z'), credit).toISOString()).toBe(
      '2026-11-19T00:00:00.000Z',
    );
  });

  it('falls back to calendar months with month-end clamping', () => {
    const legacy = { creditedFrom: null, creditedUntil: null, periodMonths: 1 };
    expect(rollbackPaidUntil(new Date('2026-03-31T00:00:00Z'), legacy).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(
      rollbackPaidUntil(new Date('2027-01-15T00:00:00Z'), {
        ...legacy,
        periodMonths: 2,
      }).toISOString(),
    ).toBe('2026-11-15T00:00:00.000Z');
  });
});

describe('grantedPeriod', () => {
  const now = new Date('2026-10-16T09:00:00Z');

  it('starts at the old paid_until when the payment stacks', () => {
    expect(grantedPeriod(new Date('2026-10-10T00:00:00Z'), 1, now)).toEqual({
      from: new Date('2026-10-10T00:00:00Z'),
      until: new Date('2026-11-10T00:00:00Z'),
      isRestart: false,
    });
  });

  it('starts at now when a long-overdue account restarts', () => {
    expect(grantedPeriod(new Date('2026-06-01T00:00:00Z'), 1, now)).toEqual({
      from: now,
      until: new Date('2026-11-16T09:00:00Z'),
      isRestart: true,
    });
  });

  it('treats an extension landing exactly on now as a restart', () => {
    expect(grantedPeriod(new Date('2026-09-16T09:00:00Z'), 1, now).isRestart).toBe(true);
  });

  it('is what extendPaidUntil returns as the new paid_until', () => {
    const paidUntil = new Date('2026-01-31T12:00:00Z');
    expect(extendPaidUntil(paidUntil, 1, now)).toEqual(grantedPeriod(paidUntil, 1, now).until);
  });
});
