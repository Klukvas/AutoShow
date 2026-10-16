import type { EntityManager } from 'typeorm';

/**
 * Raw-SQL access to the managed photo balance (photo_ai_balance totals +
 * append-only photo_ai_ledger). Shared by the photo-AI service/worker and the
 * billing service (pack purchases), so every effect locks and records the
 * same way. Each function runs inside the caller's transaction.
 *
 * Every balance-changing effect has a ledger row guarded by a partial unique
 * index, so repeats (webhooks, retries, sweeps) are no-ops.
 */

export interface PhotoBalance {
  credited: number;
  reserved: number;
  consumed: number;
  /** credited − consumed − reserved; may be negative after a refund. */
  available: number;
}

export type GenerationOutcome = 'consume' | 'release';

interface BalanceRow {
  credited: number | string;
  reserved: number | string;
  consumed: number | string;
}

const toBalance = (row: BalanceRow): PhotoBalance => {
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

/**
 * Creates the singleton once and grants the one-time free photos (if any are
 * configured and none were granted before).
 */
export async function ensureBalance(em: EntityManager, freePhotos: number): Promise<void> {
  await em.query(`INSERT INTO photo_ai_balance (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  if (freePhotos <= 0) return;
  const granted = returnedRows(
    await em.query(
      `UPDATE photo_ai_balance
          SET credited = credited + $1, free_granted_at = now(), updated_at = now()
        WHERE id = 1 AND free_granted_at IS NULL
        RETURNING id`,
      [freePhotos],
    ),
  );
  if (!granted.length) return;
  await em.query(`INSERT INTO photo_ai_ledger (entry_type, photos) VALUES ('free_grant', $1)`, [
    freePhotos,
  ]);
}

/** True when the singleton is missing or the configured free grant is still pending. */
export async function needsBalanceSetup(em: EntityManager, freePhotos: number): Promise<boolean> {
  const row = firstRow<{ free_granted_at: Date | null }>(
    await em.query(`SELECT free_granted_at FROM photo_ai_balance WHERE id = 1`),
  );
  return !row || (freePhotos > 0 && row.free_granted_at === null);
}

export async function readBalance(em: EntityManager): Promise<PhotoBalance> {
  const row = firstRow<BalanceRow>(
    await em.query(`SELECT credited, reserved, consumed FROM photo_ai_balance WHERE id = 1`),
  );
  return row ? toBalance(row) : { credited: 0, reserved: 0, consumed: 0, available: 0 };
}

/**
 * Reserves one photo for a generation. The conditional UPDATE is atomic: two
 * concurrent jobs serialize on the row lock and the second re-checks the
 * condition, so the last photo can never be reserved twice.
 */
export async function reservePhoto(
  em: EntityManager,
  generationId: string,
  actorId: string,
): Promise<boolean> {
  const updated = returnedRows(
    await em.query(
      `UPDATE photo_ai_balance
          SET reserved = reserved + 1, updated_at = now()
        WHERE id = 1 AND credited - consumed - reserved > 0
        RETURNING id`,
    ),
  );
  if (!updated.length) return false;
  await em.query(
    `INSERT INTO photo_ai_ledger (entry_type, photos, generation_id, actor_id)
     VALUES ('reserve', 1, $1, $2)`,
    [generationId, actorId],
  );
  return true;
}

/**
 * Turns a generation's reservation into a charge (consume) or gives it back
 * (release) — at most once, and only if a reservation exists.
 */
export async function settlePhoto(
  em: EntityManager,
  generationId: string,
  outcome: GenerationOutcome,
): Promise<boolean> {
  // Balance lock first: every balance writer takes it, so checks below are stable.
  await em.query(`SELECT id FROM photo_ai_balance WHERE id = 1 FOR UPDATE`);
  const open = firstRow<{ id: string }>(
    await em.query(
      `SELECT r.id FROM photo_ai_ledger r
        WHERE r.entry_type = 'reserve' AND r.generation_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM photo_ai_ledger s
             WHERE s.generation_id = $1 AND s.entry_type IN ('consume','release'))`,
      [generationId],
    ),
  );
  if (!open) return false;
  await em.query(
    `INSERT INTO photo_ai_ledger (entry_type, photos, generation_id) VALUES ($1, 1, $2)`,
    [outcome, generationId],
  );
  await em.query(
    outcome === 'consume'
      ? `UPDATE photo_ai_balance SET reserved = reserved - 1, consumed = consumed + 1,
           updated_at = now() WHERE id = 1`
      : `UPDATE photo_ai_balance SET reserved = reserved - 1, updated_at = now() WHERE id = 1`,
  );
  return true;
}

/** Credits a paid pack once per invoice. */
export async function creditPack(
  em: EntityManager,
  invoiceId: string,
  photos: number,
  actorId: string | null,
): Promise<boolean> {
  return applyPackEntry(em, 'purchase', invoiceId, photos, actorId);
}

/** Takes a fully refunded pack's photos back once per invoice (balance may go negative). */
export async function refundPack(
  em: EntityManager,
  invoiceId: string,
  photos: number,
  actorId: string | null,
): Promise<boolean> {
  return applyPackEntry(em, 'refund', invoiceId, photos, actorId);
}

async function applyPackEntry(
  em: EntityManager,
  entryType: 'purchase' | 'refund',
  invoiceId: string,
  photos: number,
  actorId: string | null,
): Promise<boolean> {
  await em.query(`INSERT INTO photo_ai_balance (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await em.query(`SELECT id FROM photo_ai_balance WHERE id = 1 FOR UPDATE`);
  const inserted = returnedRows(
    await em.query(
      `INSERT INTO photo_ai_ledger (entry_type, photos, invoice_id, actor_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [entryType, photos, invoiceId, actorId],
    ),
  );
  if (!inserted.length) return false;
  const delta = entryType === 'purchase' ? photos : -photos;
  await em.query(
    `UPDATE photo_ai_balance SET credited = credited + $1, updated_at = now() WHERE id = 1`,
    [delta],
  );
  return true;
}

/**
 * Generations whose reservation was never settled although they are finished
 * (or gone) — repaired by the worker's recovery sweep after a crash.
 */
export async function unsettledGenerations(
  em: EntityManager,
  limit: number,
): Promise<Array<{ generationId: string; outcome: GenerationOutcome }>> {
  const rows = (await em.query(
    `SELECT r.generation_id AS "generationId", g.status AS status
       FROM photo_ai_ledger r
       LEFT JOIN photo_ai_generations g ON g.id = r.generation_id
      WHERE r.entry_type = 'reserve'
        AND (g.id IS NULL OR g.status IN ('ready','failed','interrupted'))
        AND NOT EXISTS (
          SELECT 1 FROM photo_ai_ledger s
           WHERE s.generation_id = r.generation_id AND s.entry_type IN ('consume','release'))
      LIMIT $1`,
    [limit],
  )) as Array<{ generationId: string; status: string | null }>;
  return rows.map((row) => ({
    generationId: row.generationId,
    outcome: outcomeFor(row.status),
  }));
}

/** Only a finished, usable result is charged; everything else gives the photo back. */
export function outcomeFor(status: string | null): GenerationOutcome {
  return status === 'ready' ? 'consume' : 'release';
}
