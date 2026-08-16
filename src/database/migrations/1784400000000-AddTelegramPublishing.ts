import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telegram channel publishing: admin-editable config (bot token + channels +
 * auto-publish flag) as a jsonb blob on site_settings, and one row per
 * (listing, channel) post so posting is idempotent and «ПРОДАНО» edits know
 * which message carries the caption. Expand-only.
 */
export class AddTelegramPublishing1784400000000 implements MigrationInterface {
  name = 'AddTelegramPublishing1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "site_settings" ADD "telegram" jsonb`);
    await queryRunner.query(`
      CREATE TABLE "listing_telegram_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL DEFAULT '1',
        "listing_id" uuid NOT NULL,
        "chat_id" character varying(64) NOT NULL,
        "message_ids" jsonb NOT NULL,
        "caption_message_id" integer NOT NULL,
        "sold_marked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_listing_telegram_posts" PRIMARY KEY ("id"),
        CONSTRAINT "fk_listing_telegram_posts_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_listing_telegram_posts_listing_chat"
        ON "listing_telegram_posts" ("listing_id", "chat_id")
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_telegram_posts"`);
    await queryRunner.query(`ALTER TABLE "site_settings" DROP COLUMN "telegram"`);
  }
}
