import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consignment economics: clients list their cars through the showroom, which
 * earns a fixed listing fee or a % of the final sale price. All columns are
 * nullable or defaulted, so the migration is safe on populated tables (no
 * backfill or table rewrite needed on Postgres 11+).
 */
export class AddConsignmentFields1783990000000 implements MigrationInterface {
  name = 'AddConsignmentFields1783990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listings"
        ADD COLUMN "seller_type" character varying(16) NOT NULL DEFAULT 'own',
        ADD COLUMN "seller_name" character varying(128),
        ADD COLUMN "seller_phone" character varying(32),
        ADD COLUMN "fee_type" character varying(16) NOT NULL DEFAULT 'none',
        ADD COLUMN "fee_percent" numeric(5,2),
        ADD COLUMN "fee_fixed_amount" numeric(12,2),
        ADD COLUMN "sale_price_amount" numeric(12,2),
        ADD COLUMN "commission_amount" numeric(12,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listings"
        DROP COLUMN "commission_amount",
        DROP COLUMN "sale_price_amount",
        DROP COLUMN "fee_fixed_amount",
        DROP COLUMN "fee_percent",
        DROP COLUMN "fee_type",
        DROP COLUMN "seller_phone",
        DROP COLUMN "seller_name",
        DROP COLUMN "seller_type"
    `);
  }
}
