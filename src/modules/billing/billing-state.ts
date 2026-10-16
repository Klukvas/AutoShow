/**
 * Pure subscription state machine. Every input is explicit (including `now`)
 * so the boundaries are unit-testable without clocks or a database.
 *
 *   active   — paid, more than REMIND_DAYS left
 *   due_soon — paid, ≤ REMIND_DAYS left (admin sees a warning banner)
 *   overdue  — paid_until ≤ now < paid_until + GRACE_DAYS (admin sees an error banner)
 *   blocked  — now ≥ paid_until + GRACE_DAYS (admin panel locked)
 *
 * Durations are fixed 24h days over absolute instants, so the result does not
 * depend on the server's time zone.
 */
export type BillingState = 'active' | 'due_soon' | 'overdue' | 'blocked';

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface BillingTerms {
  remindDays: number;
  graceDays: number;
}

export interface BillingSnapshot {
  state: BillingState;
  paidUntil: Date;
  blockAt: Date;
  /** Whole days until paid_until, rounded up; ≤ 0 once it has passed. */
  daysLeft: number;
  /** Whole days until the block, rounded up; 0 once blocked. */
  daysUntilBlock: number;
}

function ceilDays(ms: number): number {
  // `|| 0` folds the -0 from Math.ceil of small negatives into a plain 0.
  return Math.ceil(ms / DAY_MS) || 0;
}

export function computeBillingState(
  paidUntil: Date,
  now: Date,
  terms: BillingTerms,
): BillingSnapshot {
  const paidUntilMs = paidUntil.getTime();
  const nowMs = now.getTime();
  const blockAtMs = paidUntilMs + terms.graceDays * DAY_MS;
  const remindFromMs = paidUntilMs - terms.remindDays * DAY_MS;

  let state: BillingState;
  if (nowMs >= blockAtMs) state = 'blocked';
  else if (nowMs >= paidUntilMs) state = 'overdue';
  else if (nowMs >= remindFromMs) state = 'due_soon';
  else state = 'active';

  return {
    state,
    paidUntil: new Date(paidUntilMs),
    blockAt: new Date(blockAtMs),
    daysLeft: ceilDays(paidUntilMs - nowMs),
    daysUntilBlock: Math.max(0, ceilDays(blockAtMs - nowMs)),
  };
}

/**
 * Calendar-month addition in UTC, clamped to the target month's last day
 * (31 Jan + 1 month → 28/29 Feb), keeping the time of day.
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Next paid_until after a payment for `months`: extends the current period,
 * or — if even the extension would still be in the past — starts from now,
 * so a long-overdue client is not charged for months they never had.
 */
export function extendPaidUntil(paidUntil: Date, months: number, now: Date): Date {
  const extended = addMonthsUtc(paidUntil, months);
  return extended.getTime() > now.getTime() ? extended : addMonthsUtc(now, months);
}
