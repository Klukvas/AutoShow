import type { EntityManager } from 'typeorm';

/**
 * Raw-SQL access to a managed AI balance: a singleton of running totals plus
 * an append-only ledger. Photo AI and AI descriptions each bind their own
 * tables; the accounting is identical, so it lives here once. Every function
 * runs inside the caller's transaction.
 *
 * Every balance-changing effect has a ledger row guarded by a partial unique
 * index, so repeats (webhooks, retries, sweeps) are no-ops.
 */

export interface CreditBalance {
  credited: number;
  reserved: number;
  consumed: number;
  /** credited − consumed − reserved; may be negative after a refund. */
  available: number;
}

export type GenerationOutcome = 'consume' | 'release';

/** Table and column names are code constants, never input. */
export type CreditTables = {
  balance: string;
  ledger: string;
  generations: string;
  /** Ledger column holding the unit count (photos, descriptions). */
  unit: string;
};

interface BalanceRow {
  credited: number | string;
  reserved: number | string;
  consumed: number | string;
}

const toBalance = (row: BalanceRow): CreditBalance => {
  const credited = Number(row.credited);
  const reserved = Number(row.reserved);
  const consumed = Number(row.consumed);
  return { credited, reserved, consumed, available: credited - consumed - reserved };
};

const firstRow = <T>(result: unknown): T | undefined =>
  Array.isArray(result) ? (result[0] as T | undefined) : undefined;

/** pg returns [rows, affectedCount] for UPDATE … RETURNING. */
const returnedRows = (result: unknown): unknown[] => {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? (result[0] as unknown[]) : result;
};

/** Only a finished, usable result is charged; everything else gives the unit back. */
export function outcomeFor(status: string | null): GenerationOutcome {
  return status === 'ready' ? 'consume' : 'release';
}

export function createCreditStore({ balance, ledger, generations, unit }: CreditTables) {
  /** Creates the singleton once and grants the one-time free units (if configured). */
  async function ensureBalance(em: EntityManager, free: number): Promise<void> {
    await em.query(`INSERT INTO ${balance} (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    if (free <= 0) return;
    const granted = returnedRows(
      await em.query(
        `UPDATE ${balance}
            SET credited = credited + $1, free_granted_at = now(), updated_at = now()
          WHERE id = 1 AND free_granted_at IS NULL
          RETURNING id`,
        [free],
      ),
    );
    if (!granted.length) return;
    await em.query(`INSERT INTO ${ledger} (entry_type, ${unit}) VALUES ('free_grant', $1)`, [free]);
  }

  /** True when the singleton is missing or the configured free grant is still pending. */
  async function needsBalanceSetup(em: EntityManager, free: number): Promise<boolean> {
    const row = firstRow<{ free_granted_at: Date | null }>(
      await em.query(`SELECT free_granted_at FROM ${balance} WHERE id = 1`),
    );
    return !row || (free > 0 && row.free_granted_at === null);
  }

  async function readBalance(em: EntityManager): Promise<CreditBalance> {
    const row = firstRow<BalanceRow>(
      await em.query(`SELECT credited, reserved, consumed FROM ${balance} WHERE id = 1`),
    );
    return row ? toBalance(row) : { credited: 0, reserved: 0, consumed: 0, available: 0 };
  }

  /**
   * Reserves one unit for a generation. The conditional UPDATE is atomic: two
   * concurrent jobs serialize on the row lock and the second re-checks the
   * condition, so the last unit can never be reserved twice.
   */
  async function reserve(em: EntityManager, generationId: string, actorId: string) {
    const updated = returnedRows(
      await em.query(
        `UPDATE ${balance}
            SET reserved = reserved + 1, updated_at = now()
          WHERE id = 1 AND credited - consumed - reserved > 0
          RETURNING id`,
      ),
    );
    if (!updated.length) return false;
    await em.query(
      `INSERT INTO ${ledger} (entry_type, ${unit}, generation_id, actor_id)
       VALUES ('reserve', 1, $1, $2)`,
      [generationId, actorId],
    );
    return true;
  }

  /**
   * Turns a generation's reservation into a charge (consume) or gives it back
   * (release) — at most once, and only if a reservation exists.
   */
  async function settle(
    em: EntityManager,
    generationId: string,
    outcome: GenerationOutcome,
  ): Promise<boolean> {
    // Balance lock first: every balance writer takes it, so checks below are stable.
    await em.query(`SELECT id FROM ${balance} WHERE id = 1 FOR UPDATE`);
    const open = firstRow<{ id: string }>(
      await em.query(
        `SELECT r.id FROM ${ledger} r
          WHERE r.entry_type = 'reserve' AND r.generation_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM ${ledger} s
               WHERE s.generation_id = $1 AND s.entry_type IN ('consume','release'))`,
        [generationId],
      ),
    );
    if (!open) return false;
    await em.query(
      `INSERT INTO ${ledger} (entry_type, ${unit}, generation_id) VALUES ($1, 1, $2)`,
      [outcome, generationId],
    );
    await em.query(
      outcome === 'consume'
        ? `UPDATE ${balance} SET reserved = reserved - 1, consumed = consumed + 1,
             updated_at = now() WHERE id = 1`
        : `UPDATE ${balance} SET reserved = reserved - 1, updated_at = now() WHERE id = 1`,
    );
    return true;
  }

  async function applyPackEntry(
    em: EntityManager,
    entryType: 'purchase' | 'refund',
    invoiceId: string,
    units: number,
    actorId: string | null,
  ): Promise<boolean> {
    await em.query(`INSERT INTO ${balance} (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    await em.query(`SELECT id FROM ${balance} WHERE id = 1 FOR UPDATE`);
    const inserted = returnedRows(
      await em.query(
        `INSERT INTO ${ledger} (entry_type, ${unit}, invoice_id, actor_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [entryType, units, invoiceId, actorId],
      ),
    );
    if (!inserted.length) return false;
    const delta = entryType === 'purchase' ? units : -units;
    await em.query(
      `UPDATE ${balance} SET credited = credited + $1, updated_at = now() WHERE id = 1`,
      [delta],
    );
    return true;
  }

  /**
   * Generations whose reservation was never settled although they are finished
   * (or gone) — repaired by the worker's recovery sweep after a crash.
   */
  async function unsettledGenerations(
    em: EntityManager,
    limit: number,
  ): Promise<Array<{ generationId: string; outcome: GenerationOutcome }>> {
    const rows = (await em.query(
      `SELECT r.generation_id AS "generationId", g.status AS status
         FROM ${ledger} r
         LEFT JOIN ${generations} g ON g.id = r.generation_id
        WHERE r.entry_type = 'reserve'
          AND (g.id IS NULL OR g.status IN ('ready','failed','interrupted'))
          AND NOT EXISTS (
            SELECT 1 FROM ${ledger} s
             WHERE s.generation_id = r.generation_id AND s.entry_type IN ('consume','release'))
        LIMIT $1`,
      [limit],
    )) as Array<{ generationId: string; status: string | null }>;
    return rows.map((row) => ({ generationId: row.generationId, outcome: outcomeFor(row.status) }));
  }

  return {
    ensureBalance,
    needsBalanceSetup,
    readBalance,
    reserve,
    settle,
    /** Credits a paid pack once per invoice. */
    creditPack: (em: EntityManager, invoiceId: string, units: number, actorId: string | null) =>
      applyPackEntry(em, 'purchase', invoiceId, units, actorId),
    /** Takes a fully refunded pack back once per invoice (balance may go negative). */
    refundPack: (em: EntityManager, invoiceId: string, units: number, actorId: string | null) =>
      applyPackEntry(em, 'refund', invoiceId, units, actorId),
    unsettledGenerations,
  };
}

export type CreditStore = ReturnType<typeof createCreditStore>;
