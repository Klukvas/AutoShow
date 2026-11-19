import { MigrationInterface, QueryRunner } from 'typeorm';

/** Optional photo or video link on a curated homepage review. */
export class ReviewMedia1792001500000 implements MigrationInterface {
  name = 'ReviewMedia1792001500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ADD "media_url" character varying(512)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "media_url"`);
  }
}
