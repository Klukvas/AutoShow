import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payment history is evidence, not cache: the runtime role must not delete
 * billing rows. 1792000600000 granted only SELECT/INSERT/UPDATE, but the
 * schema's default privileges (docker/postgres/init) give new tables DELETE
 * too — revoke it explicitly. down() restores the previous effective state.
 */
export class RevokeBillingDeletes1792000900000 implements MigrationInterface {
  name = 'RevokeBillingDeletes1792000900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = appRole();
    await queryRunner.query(`REVOKE DELETE ON billing_account, billing_invoices FROM "${appUser}"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const appUser = appRole();
    await queryRunner.query(`GRANT DELETE ON billing_account, billing_invoices TO "${appUser}"`);
  }
}

function appRole(): string {
  const appUser = process.env.DB_APP_USER ?? 'app_user';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(appUser)) throw new Error('Invalid DB_APP_USER role name');
  return appUser;
}
