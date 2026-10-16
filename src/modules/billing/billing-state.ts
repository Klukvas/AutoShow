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
  return grantedPeriod(paidUntil, months, now).until;
}

export interface GrantedPeriod {
  /** Old paid_until when the payment stacks; `now` when it restarts. */
  from: Date;
  /** The new paid_until. */
  until: Date;
  isRestart: boolean;
}

/** The period one payment grants — see extendPaidUntil for the rule. */
export function grantedPeriod(paidUntil: Date, months: number, now: Date): GrantedPeriod {
  const extended = addMonthsUtc(paidUntil, months);
  if (extended.getTime() > now.getTime()) {
    return { from: new Date(paidUntil.getTime()), until: extended, isRestart: false };
  }
  return { from: new Date(now.getTime()), until: addMonthsUtc(now, months), isRestart: true };
}

export interface CreditedPeriod {
  creditedFrom: Date | null;
  creditedUntil: Date | null;
  periodMonths: number;
}

/**
 * paid_until after a full refund: subtract exactly what that payment added,
 * so later (stacked) payments and manual extensions are kept. Credits made
 * before the before/after values were stored fall back to the invoice's
 * period in calendar months. The result may be in the past (→ overdue/blocked).
 */
export function rollbackPaidUntil(current: Date, credit: CreditedPeriod): Date {
  if (credit.creditedFrom && credit.creditedUntil) {
    const added = credit.creditedUntil.getTime() - credit.creditedFrom.getTime();
    return new Date(current.getTime() - added);
  }
  return addMonthsUtc(current, -credit.periodMonths);
}
