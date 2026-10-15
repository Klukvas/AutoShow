import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhotoAi1792000000000 implements MigrationInterface {
  name = 'PhotoAi1792000000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'app_user';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');
    await queryRunner.query(
      `ALTER TABLE listing_telegram_posts ADD COLUMN photo_ai_disclosure varchar(8)`,
    );
    await queryRunner.query(
      `ALTER TABLE listing_media ADD COLUMN active_ai_variant jsonb, ADD COLUMN ai_revision integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`CREATE TABLE photo_ai_generations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), media_id uuid NOT NULL REFERENCES listing_media(id) ON DELETE CASCADE,
      listing_id uuid NOT NULL, actor_id uuid NOT NULL, request_id uuid NOT NULL, fingerprint varchar(64) NOT NULL,
      category varchar(12) NOT NULL CHECK (category IN ('enhance','scene')), prompt text NOT NULL, effective_prompt text NOT NULL,
      source_s3_key varchar(512) NOT NULL, status varchar(20) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','ready','failed','interrupted')),
      failure_reason varchar(255), provider_started_at timestamptz, output_stored_at timestamptz, artifacts_cleaned_at timestamptz, manifest jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, version integer NOT NULL DEFAULT 1,
      UNIQUE(actor_id, request_id))`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_photo_ai_inflight ON photo_ai_generations(media_id) WHERE status IN ('queued','processing') AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_photo_ai_media_created ON photo_ai_generations(media_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_photo_ai_actor_created ON photo_ai_generations(actor_id, created_at)`,
    );
    await queryRunner.query(`CREATE TABLE photo_ai_presets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
      name varchar(80) NOT NULL, category varchar(12) NOT NULL CHECK(category IN ('enhance','scene')), prompt text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, version integer NOT NULL DEFAULT 1)`);
    await queryRunner.query(`CREATE INDEX ix_photo_ai_preset_actor ON photo_ai_presets(actor_id)`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON photo_ai_generations, photo_ai_presets, listing_telegram_posts TO "${appUser}"`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listing_telegram_posts DROP COLUMN photo_ai_disclosure`);
    await queryRunner.query(`DROP TABLE photo_ai_presets`);
    await queryRunner.query(`DROP TABLE photo_ai_generations`);
    await queryRunner.query(
      `ALTER TABLE listing_media DROP COLUMN active_ai_variant, DROP COLUMN ai_revision`,
    );
  }
}
