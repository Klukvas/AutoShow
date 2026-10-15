import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhotoAiAccess1792000200000 implements MigrationInterface {
  name = 'PhotoAiAccess1792000200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE photo_ai_settings
      ADD COLUMN access_mode varchar(12) NOT NULL DEFAULT 'all' CHECK (access_mode IN ('admins','all','selected')),
      ADD COLUMN selected_editor_ids uuid[] NOT NULL DEFAULT '{}'::uuid[] CHECK (cardinality(selected_editor_ids) <= 200)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE photo_ai_settings DROP COLUMN selected_editor_ids, DROP COLUMN access_mode`,
    );
  }
}
