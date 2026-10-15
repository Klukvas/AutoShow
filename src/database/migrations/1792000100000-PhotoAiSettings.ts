import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhotoAiSettings1792000100000 implements MigrationInterface {
  name = 'PhotoAiSettings1792000100000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'app_user';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');
    await queryRunner.query(`CREATE TABLE photo_ai_settings (
      id smallint PRIMARY KEY CHECK (id = 1), enabled boolean NOT NULL DEFAULT false,
      encrypted_key text, revision integer NOT NULL DEFAULT 0)`);
    await queryRunner.query(`INSERT INTO photo_ai_settings(id) VALUES (1)`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON photo_ai_settings TO "${appUser}"`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE photo_ai_settings`);
  }
}
