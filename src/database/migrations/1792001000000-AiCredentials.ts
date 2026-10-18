import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves the stored AI provider key out of photo_ai_settings into a shared
 * singleton, so every AI feature reads one key while keeping its own enable
 * flag and access policy.
 *
 * The ciphertext is copied as is (same master key, same AAD). Expand-only
 * (deploy/README.md): the still-running old app reads
 * photo_ai_settings.encrypted_key until it flips over, so that column is left
 * intact here. Clearing and dropping it is a separate, later release once no
 * deployed code reads it. down() copies the current key back into it.
 *
 * The runtime role may only read and update the single row: default schema
 * privileges would also give it INSERT/DELETE on a new table.
 */
export class AiCredentials1792001000000 implements MigrationInterface {
  name = 'AiCredentials1792001000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = appRole();
    await queryRunner.query(`CREATE TABLE ai_credentials (
      id smallint PRIMARY KEY CHECK (id = 1),
      encrypted_key text,
      revision integer NOT NULL DEFAULT 0)`);
    await queryRunner.query(`INSERT INTO ai_credentials (id, encrypted_key)
      VALUES (1, (SELECT encrypted_key FROM photo_ai_settings WHERE id = 1))`);
    await queryRunner.query(`GRANT SELECT, UPDATE ON ai_credentials TO "${appUser}"`);
    await queryRunner.query(`REVOKE INSERT, DELETE ON ai_credentials FROM "${appUser}"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE photo_ai_settings
      SET encrypted_key = (SELECT encrypted_key FROM ai_credentials WHERE id = 1)
      WHERE id = 1`);
    await queryRunner.query(`DROP TABLE ai_credentials`);
  }
}

function appRole(): string {
  const appUser = process.env.DB_APP_USER ?? 'app_user';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');
  return appUser;
}
