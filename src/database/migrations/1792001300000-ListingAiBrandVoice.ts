import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brand voice for AI descriptions: tone, banned words and a style example.
 * Expand-only: nullable or defaulted columns the running app ignores.
 */
export class ListingAiBrandVoice1792001300000 implements MigrationInterface {
  name = 'ListingAiBrandVoice1792001300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listing_ai_settings
      ADD COLUMN brand_tone varchar(500),
      ADD COLUMN brand_banned_words varchar(40)[] NOT NULL DEFAULT '{}'::varchar(40)[]
        CHECK (cardinality(brand_banned_words) <= 50),
      ADD COLUMN brand_example varchar(2000)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE listing_ai_settings
      DROP COLUMN brand_example,
      DROP COLUMN brand_banned_words,
      DROP COLUMN brand_tone`);
  }
}
