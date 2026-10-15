import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminAuthVersion1792000300000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE admin_users ADD COLUMN auth_version integer NOT NULL DEFAULT 1',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE admin_users DROP COLUMN auth_version');
  }
}
