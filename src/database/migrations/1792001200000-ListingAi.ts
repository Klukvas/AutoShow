import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI listing descriptions: generation history, the feature's own switch and
 * access policy, and a managed-mode balance kept apart from the photo one.
 * Expand-only: new tables nothing running reads yet.
 *
 * - listing_ai_generations is history. The runtime role may insert and update
 *   (status, result, acceptance) but never delete it; a hard-deleted listing
 *   still takes its drafts along through the FK cascade.
 * - uq_listing_ai_inflight: one queued/processing draft per listing, input and
 *   preset, so a double click or a retry never pays twice.
 * - listing_ai_balance / listing_ai_ledger mirror photo_ai_balance /
 *   photo_ai_ledger: running totals plus an append-only ledger whose partial
 *   unique indexes make every effect happen at most once.
 */
export class ListingAi1792001200000 implements MigrationInterface {
  name = 'ListingAi1792001200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = appRole();

    await queryRunner.query(`CREATE TABLE listing_ai_generations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      actor_id uuid NOT NULL,
      request_id uuid NOT NULL,
      preset varchar(16) NOT NULL CHECK (preset IN ('short','standard','detailed')),
      input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
      input_snapshot jsonb NOT NULL,
      photo_media_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
        CHECK (cardinality(photo_media_ids) <= 5),
      prompt_version varchar(32) NOT NULL,
      model varchar(64) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','processing','ready','failed','interrupted')),
      failure_reason varchar(255),
      result jsonb,
      validation jsonb,
      input_tokens integer CHECK (input_tokens >= 0),
      output_tokens integer CHECK (output_tokens >= 0),
      cost_usd numeric(10,6) CHECK (cost_usd >= 0),
      latency_ms integer CHECK (latency_ms >= 0),
      provider_started_at timestamptz,
      accepted_at timestamptz,
      accepted_by uuid,
      accepted_fields varchar(24)[]
        CHECK (accepted_fields <@ ARRAY['description','metaTitle','metaDescription']::varchar(24)[]),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      version integer NOT NULL DEFAULT 1,
      UNIQUE (actor_id, request_id),
      CONSTRAINT ck_listing_ai_ready_result CHECK ((status = 'ready') = (result IS NOT NULL)),
      CONSTRAINT ck_listing_ai_accept CHECK (
        (accepted_at IS NULL AND accepted_by IS NULL AND accepted_fields IS NULL) OR
        (status = 'ready' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL
          AND accepted_fields IS NOT NULL
          AND cardinality(accepted_fields) BETWEEN 1 AND 3)))`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_listing_ai_inflight
      ON listing_ai_generations (listing_id, input_hash, preset)
      WHERE status IN ('queued','processing') AND deleted_at IS NULL`);
    await queryRunner.query(
      `CREATE INDEX ix_listing_ai_listing_created ON listing_ai_generations (listing_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_listing_ai_actor_created ON listing_ai_generations (actor_id, created_at)`,
    );

    await queryRunner.query(`CREATE TABLE listing_ai_settings (
      id smallint PRIMARY KEY CHECK (id = 1),
      enabled boolean NOT NULL DEFAULT false,
      revision integer NOT NULL DEFAULT 0,
      access_mode varchar(12) NOT NULL DEFAULT 'all'
        CHECK (access_mode IN ('admins','all','selected')),
      selected_editor_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
        CHECK (cardinality(selected_editor_ids) <= 200))`);
    await queryRunner.query(`INSERT INTO listing_ai_settings (id) VALUES (1)`);

    await queryRunner.query(`CREATE TABLE listing_ai_balance (
      id smallint PRIMARY KEY CHECK (id = 1),
      credited integer NOT NULL DEFAULT 0,
      reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
      consumed integer NOT NULL DEFAULT 0 CHECK (consumed >= 0),
      free_granted_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now())`);

    await queryRunner.query(`CREATE TABLE listing_ai_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_type varchar(16) NOT NULL CHECK (entry_type IN
        ('free_grant','purchase','refund','reserve','consume','release')),
      descriptions integer NOT NULL CHECK (descriptions > 0),
      generation_id uuid,
      invoice_id varchar(64),
      actor_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((entry_type IN ('reserve','consume','release')) = (generation_id IS NOT NULL)),
      CHECK ((entry_type IN ('purchase','refund')) = (invoice_id IS NOT NULL)))`);
    for (const sql of [
      `CREATE UNIQUE INDEX ux_listing_ai_ledger_reserve ON listing_ai_ledger (generation_id) WHERE entry_type = 'reserve'`,
      `CREATE UNIQUE INDEX ux_listing_ai_ledger_settle ON listing_ai_ledger (generation_id) WHERE entry_type IN ('consume','release')`,
      `CREATE UNIQUE INDEX ux_listing_ai_ledger_purchase ON listing_ai_ledger (invoice_id) WHERE entry_type = 'purchase'`,
      `CREATE UNIQUE INDEX ux_listing_ai_ledger_refund ON listing_ai_ledger (invoice_id) WHERE entry_type = 'refund'`,
      `CREATE UNIQUE INDEX ux_listing_ai_ledger_free ON listing_ai_ledger (entry_type) WHERE entry_type = 'free_grant'`,
      `CREATE INDEX ix_listing_ai_ledger_created ON listing_ai_ledger (created_at DESC)`,
    ])
      await queryRunner.query(sql);

    // Default schema privileges also grant DELETE (and INSERT on singletons),
    // so every table states exactly what the runtime role may do.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON listing_ai_generations TO "${appUser}"`,
    );
    await queryRunner.query(`REVOKE DELETE ON listing_ai_generations FROM "${appUser}"`);
    await queryRunner.query(`GRANT SELECT, UPDATE ON listing_ai_settings TO "${appUser}"`);
    await queryRunner.query(`REVOKE INSERT, DELETE ON listing_ai_settings FROM "${appUser}"`);
    // INSERT stays: the store creates the balance row on first use, as for photos.
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON listing_ai_balance TO "${appUser}"`);
    await queryRunner.query(`REVOKE DELETE ON listing_ai_balance FROM "${appUser}"`);
    await queryRunner.query(`GRANT SELECT, INSERT ON listing_ai_ledger TO "${appUser}"`);
    await queryRunner.query(`REVOKE UPDATE, DELETE ON listing_ai_ledger FROM "${appUser}"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Purchases and refunds are payment evidence: never drop them silently.
    const paid = (await queryRunner.query(
      `SELECT count(*)::int AS n FROM listing_ai_ledger WHERE entry_type IN ('purchase','refund')`,
    )) as Array<{ n: number }>;
    if (Number(paid[0]?.n ?? 0) > 0) {
      throw new Error(
        `Cannot revert ListingAi: ${paid[0].n} description purchase/refund ledger row(s) exist. ` +
          'They are payment records — export and reconcile them, then remove them deliberately.',
      );
    }
    await queryRunner.query(`DROP TABLE listing_ai_ledger`);
    await queryRunner.query(`DROP TABLE listing_ai_balance`);
    await queryRunner.query(`DROP TABLE listing_ai_settings`);
    await queryRunner.query(`DROP TABLE listing_ai_generations`);
  }
}

function appRole(): string {
  const appUser = process.env.DB_APP_USER ?? 'app_user';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');
  return appUser;
}
