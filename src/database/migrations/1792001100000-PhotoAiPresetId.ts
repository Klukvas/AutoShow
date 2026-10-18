import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Builtin presets are resolved server-side by id so their instructions never
 * reach the client. Expand-only: a nullable column the old app ignores.
 */
export class PhotoAiPresetId1792001100000 implements MigrationInterface {
  name = 'PhotoAiPresetId1792001100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE photo_ai_generations ADD COLUMN preset_id varchar(32)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE photo_ai_generations DROP COLUMN preset_id`);
  }
}
