import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hosting subscription: a singleton paid-until account plus the Monobank
 * invoice history. The account row is NOT inserted here — the app seeds it on
 * first use from BILLING_INITIAL_PAID_UNTIL (or now + one period), so a deploy
 * with billing disabled never starts a clock.
 *
 * The runtime user gets no DELETE: payment history is evidence, not cache.
 */
export class Billing1792000600000 implements MigrationInterface {
  name = 'Billing1792000600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'app_user';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');

    await queryRunner.query(`CREATE TABLE billing_account (
      id smallint PRIMARY KEY CHECK (id = 1),
      paid_until timestamptz NOT NULL,
      revision integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now())`);

    await queryRunner.query(`CREATE TABLE billing_invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id varchar(64) NOT NULL,
      amount_kop integer NOT NULL CHECK (amount_kop > 0),
      ccy smallint NOT NULL,
      status varchar(16) NOT NULL,
      period_months smallint NOT NULL CHECK (period_months > 0),
      page_url text NOT NULL,
      created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      modified_at timestamptz,
      credited_at timestamptz,
      CONSTRAINT uq_billing_invoices_invoice_id UNIQUE (invoice_id))`);
    await queryRunner.query(
      `CREATE INDEX ix_billing_invoices_created ON billing_invoices (created_at DESC)`,
    );

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON billing_account TO "${appUser}"`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON billing_invoices TO "${appUser}"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE billing_invoices`);
    await queryRunner.query(`DROP TABLE billing_account`);
  }
}
