import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refund rollback: each credited invoice remembers the start/end of the period
 * that credit granted (start = old paid_until when stacked, the credit instant
 * when restarted), so a full refund (status `reversed`) can take back exactly
 * that much and no more. reversed_at makes the rollback happen at most once.
 *
 * Table-level GRANTs from 1792000600000 already cover new columns.
 */
export class BillingRefundRollback1792000700000 implements MigrationInterface {
  name = 'BillingRefundRollback1792000700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE billing_invoices
      ADD COLUMN credited_from timestamptz,
      ADD COLUMN credited_until timestamptz,
      ADD COLUMN reversed_at timestamptz`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE billing_invoices
      DROP COLUMN reversed_at,
      DROP COLUMN credited_until,
      DROP COLUMN credited_from`);
  }
}
