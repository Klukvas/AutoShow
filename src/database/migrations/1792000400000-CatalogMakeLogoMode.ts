import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogMakeLogoMode1792000400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE catalog_makes ADD COLUMN logo_mode varchar(16) NOT NULL DEFAULT 'auto' CHECK (logo_mode IN ('auto', 'manual', 'none'))`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE catalog_makes DROP COLUMN logo_mode');
  }
}
