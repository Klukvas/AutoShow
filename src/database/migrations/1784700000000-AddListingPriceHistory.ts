import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Price history + "price dropped" badge support.
 *
 * - listing_price_history: append-only trail of every price a listing has had
 *   (amount+currency+normalized+actor). Source of truth / future price chart.
 * - listings.previous_price_normalized / price_changed_at: a denormalized cache
 *   of the price before the last change so the storefront can render a "price
 *   dropped" badge in O(1) (no per-card history subquery). Both are cleared on
 *   a base-currency change (values would otherwise mix currency bases).
 *
 * Nullable columns + new table → expand-only.
 */
export class AddListingPriceHistory1784700000000 implements MigrationInterface {
  name = 'AddListingPriceHistory1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" ADD "previous_price_normalized" numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD "price_changed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`
      CREATE TABLE "listing_price_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "listing_id" uuid NOT NULL,
        "price_amount" numeric(12,2) NOT NULL,
        "price_currency" character varying(3) NOT NULL,
        "price_normalized" numeric(14,2) NOT NULL,
        "actor_id" uuid,
        CONSTRAINT "pk_listing_price_history" PRIMARY KEY ("id"),
        CONSTRAINT "fk_listing_price_history_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_listing_price_history_actor" FOREIGN KEY ("actor_id")
          REFERENCES "admin_users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_listing_price_history_listing" ON "listing_price_history" ("listing_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_price_history"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "price_changed_at"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "previous_price_normalized"`);
  }
}
