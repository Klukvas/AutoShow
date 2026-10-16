import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Managed photo-AI mode: a photo balance sold in packs through the existing
 * Monobank invoices.
 *
 * - billing_invoices gets a `kind` (existing rows = hosting) and `photos`;
 *   period_months becomes hosting-only.
 * - photo_ai_balance is a singleton of running totals; photo_ai_ledger is the
 *   append-only history they are derived from:
 *     credited = Σ free_grant + Σ purchase − Σ refund
 *     reserved = Σ reserve − Σ consume − Σ release
 *     consumed = Σ consume,   available = credited − consumed − reserved
 *   Partial unique indexes make every effect happen at most once.
 *
 * down() refuses to run while photo-pack invoices exist: they are payment
 * records and are never deleted — export/reconcile them first.
 */
export class PhotoAiCredits1792000800000 implements MigrationInterface {
  name = 'PhotoAiCredits1792000800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'app_user';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');

    await queryRunner.query(`ALTER TABLE billing_invoices
      ADD COLUMN kind varchar(16) NOT NULL DEFAULT 'hosting',
      ADD COLUMN photos integer,
      ALTER COLUMN period_months DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE billing_invoices
      ADD CONSTRAINT ck_billing_invoices_kind CHECK (
        (kind = 'hosting' AND period_months IS NOT NULL AND photos IS NULL) OR
        (kind = 'photo_pack' AND photos > 0 AND period_months IS NULL))`);

    await queryRunner.query(`CREATE TABLE photo_ai_balance (
      id smallint PRIMARY KEY CHECK (id = 1),
      credited integer NOT NULL DEFAULT 0,
      reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
      consumed integer NOT NULL DEFAULT 0 CHECK (consumed >= 0),
      free_granted_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now())`);

    await queryRunner.query(`CREATE TABLE photo_ai_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_type varchar(16) NOT NULL CHECK (entry_type IN
        ('free_grant','purchase','refund','reserve','consume','release')),
      photos integer NOT NULL CHECK (photos > 0),
      generation_id uuid,
      invoice_id varchar(64),
      actor_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((entry_type IN ('reserve','consume','release')) = (generation_id IS NOT NULL)),
      CHECK ((entry_type IN ('purchase','refund')) = (invoice_id IS NOT NULL)))`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_photo_ai_ledger_reserve ON photo_ai_ledger (generation_id) WHERE entry_type = 'reserve'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_photo_ai_ledger_settle ON photo_ai_ledger (generation_id) WHERE entry_type IN ('consume','release')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_photo_ai_ledger_purchase ON photo_ai_ledger (invoice_id) WHERE entry_type = 'purchase'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_photo_ai_ledger_refund ON photo_ai_ledger (invoice_id) WHERE entry_type = 'refund'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_photo_ai_ledger_free ON photo_ai_ledger (entry_type) WHERE entry_type = 'free_grant'`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_photo_ai_ledger_created ON photo_ai_ledger (created_at DESC)`,
    );

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON photo_ai_balance TO "${appUser}"`);
    // Deleting the singleton would re-trigger the free grant (→ unique conflict).
    await queryRunner.query(`REVOKE DELETE ON photo_ai_balance FROM "${appUser}"`);
    // Append-only: the runtime user may add history, never rewrite it. The
    // schema's default privileges grant UPDATE/DELETE on new tables, so revoke
    // them explicitly (same as audit_logs).
    await queryRunner.query(`GRANT SELECT, INSERT ON photo_ai_ledger TO "${appUser}"`);
    await queryRunner.query(`REVOKE UPDATE, DELETE ON photo_ai_ledger FROM "${appUser}"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const packs = (await queryRunner.query(
      `SELECT count(*)::int AS n FROM billing_invoices WHERE kind = 'photo_pack'`,
    )) as Array<{ n: number }>;
    if (Number(packs[0]?.n ?? 0) > 0) {
      throw new Error(
        `Cannot revert PhotoAiCredits: ${packs[0].n} photo-pack invoice(s) exist. They are ` +
          'payment records — export and reconcile them, then remove them deliberately.',
      );
    }
    await queryRunner.query(`DROP TABLE photo_ai_ledger`);
    await queryRunner.query(`DROP TABLE photo_ai_balance`);
    await queryRunner.query(
      `ALTER TABLE billing_invoices DROP CONSTRAINT ck_billing_invoices_kind`,
    );
    await queryRunner.query(`ALTER TABLE billing_invoices
      ALTER COLUMN period_months SET NOT NULL,
      DROP COLUMN photos,
      DROP COLUMN kind`);
  }
}
