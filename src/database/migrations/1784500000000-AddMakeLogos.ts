import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manufacturer logos on catalog makes: the S3 key of the fetched logo and the
 * timestamp of the last fetch attempt (so misses aren't retried every sweep).
 * Expand-only.
 */
export class AddMakeLogos1784500000000 implements MigrationInterface {
  name = 'AddMakeLogos1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_makes" ADD "logo_s3_key" character varying(512)`);
    await queryRunner.query(
      `ALTER TABLE "catalog_makes" ADD "logo_checked_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_makes" DROP COLUMN "logo_checked_at"`);
    await queryRunner.query(`ALTER TABLE "catalog_makes" DROP COLUMN "logo_s3_key"`);
  }
}
