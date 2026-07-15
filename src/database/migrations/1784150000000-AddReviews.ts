import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer testimonials curated from the back office + two new lead types
 * (sell_request: consignment intake, credit: financing request) added to the
 * leads type CHECK constraint.
 */
export class AddReviews1784150000000 implements MigrationInterface {
  name = 'AddReviews1784150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "ck_leads_type"`);
    await queryRunner.query(`
      ALTER TABLE "leads" ADD CONSTRAINT "ck_leads_type"
        CHECK (type IN ('callback', 'message', 'test_drive', 'sell_request', 'credit'))
    `);
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL DEFAULT '1',
        "author_name" character varying(128) NOT NULL,
        "city" character varying(128),
        "text" text NOT NULL,
        "rating" integer NOT NULL DEFAULT '5',
        "is_published" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL DEFAULT '0',
        CONSTRAINT "pk_reviews" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_reviews_published_position" ON "reviews" ("is_published", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "ck_leads_type"`);
    await queryRunner.query(`
      ALTER TABLE "leads" ADD CONSTRAINT "ck_leads_type"
        CHECK (type IN ('callback', 'message', 'test_drive'))
    `);
  }
}
