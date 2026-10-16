import type { EntityManager } from 'typeorm';
import { grantedPeriod, rollbackPaidUntil, type CreditedPeriod } from './billing-state';

/**
 * Raw-SQL access to the billing_account singleton. Shared by the Nest service
 * and the `billing:extend` CLI so both lock and extend the row the same way.
 */

interface PaidUntilRow {
  paid_until: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Creates the singleton once (first use). Concurrent seeders are a no-op. */
export async function seedAccount(em: EntityManager, seedPaidUntil: Date): Promise<void> {
  await em.query(
    `INSERT INTO billing_account (id, paid_until, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO NOTHING`,
    [seedPaidUntil],
  );
}

export async function readPaidUntil(em: EntityManager): Promise<Date | null> {
  const rows = (await em.query(`SELECT paid_until FROM billing_account WHERE id = 1`)) as
    | PaidUntilRow[]
    | undefined;
  const row = rows?.[0];
  return row ? toDate(row.paid_until) : null;
}

/** Must run inside a transaction: row-locks the account until commit. */
export async function lockPaidUntil(em: EntityManager, seedPaidUntil: Date): Promise<Date> {
  await seedAccount(em, seedPaidUntil);
  const rows = (await em.query(
    `SELECT paid_until FROM billing_account WHERE id = 1 FOR UPDATE`,
  )) as PaidUntilRow[];
  const row = rows[0];
  if (!row) throw new Error('billing_account row missing after seed');
  return toDate(row.paid_until);
}

export interface PaidUntilChange {
  before: Date;
  after: Date;
}

async function writePaidUntil(em: EntityManager, paidUntil: Date): Promise<void> {
  await em.query(
    `UPDATE billing_account
        SET paid_until = $1, revision = revision + 1, updated_at = now()
      WHERE id = 1`,
    [paidUntil],
  );
}

/** Must run inside a transaction. Takes back what one refunded credit added. */
export async function rollbackAccount(
  em: EntityManager,
  credit: CreditedPeriod,
  seedPaidUntil: Date,
): Promise<PaidUntilChange> {
  const before = await lockPaidUntil(em, seedPaidUntil);
  const after = rollbackPaidUntil(before, credit);
  await writePaidUntil(em, after);
  return { before, after };
}

export interface CreditChange extends PaidUntilChange {
  /**
   * Start of the period this credit granted: `before` when stacked, the credit
   * instant when a long-overdue account restarted. Storing this (not `before`)
   * keeps a later refund from also taking back the forgiven gap.
   */
  creditedFrom: Date;
}

/** Must run inside a transaction. Adds `months` to the locked account. */
export async function extendAccount(
  em: EntityManager,
  months: number,
  now: Date,
  seedPaidUntil: Date,
): Promise<CreditChange> {
  const before = await lockPaidUntil(em, seedPaidUntil);
  const granted = grantedPeriod(before, months, now);
  await writePaidUntil(em, granted.until);
  return { before, after: granted.until, creditedFrom: granted.from };
}
