import { PhotoAiCredits1792000800000 } from './1792000800000-PhotoAiCredits';
import { RevokeBillingDeletes1792000900000 } from './1792000900000-RevokeBillingDeletes';

const originalRole = process.env.DB_APP_USER;
beforeEach(() => {
  process.env.DB_APP_USER = 'app_user';
});
afterAll(() => {
  if (originalRole === undefined) delete process.env.DB_APP_USER;
  else process.env.DB_APP_USER = originalRole;
});

function runner(packCount: number) {
  return {
    query: jest.fn(async (sql: string) =>
      sql.includes('count(*)') ? [{ n: packCount }] : undefined,
    ),
  };
}

describe('PhotoAiCredits migration down()', () => {
  it('refuses to revert while photo-pack invoices exist and changes nothing', async () => {
    const qr = runner(2);
    await expect(new PhotoAiCredits1792000800000().down(qr as never)).rejects.toThrow(
      '2 photo-pack invoice(s) exist',
    );
    expect(qr.query).toHaveBeenCalledTimes(1);
  });

  it('reverts the schema when no photo-pack invoices exist, without deleting rows', async () => {
    const qr = runner(0);
    await new PhotoAiCredits1792000800000().down(qr as never);
    const statements = qr.query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes('DROP TABLE photo_ai_ledger'))).toBe(true);
    expect(statements.some((sql) => /DELETE FROM/i.test(sql))).toBe(false);
  });

  it('revokes DELETE on the balance singleton and UPDATE/DELETE on the ledger', async () => {
    const qr = runner(0);
    await new PhotoAiCredits1792000800000().up(qr as never);
    const statements = qr.query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toContain('REVOKE DELETE ON photo_ai_balance FROM "app_user"');
    expect(statements).toContain('REVOKE UPDATE, DELETE ON photo_ai_ledger FROM "app_user"');
  });
});

describe('RevokeBillingDeletes migration', () => {
  it('revokes DELETE on billing tables and restores it on down()', async () => {
    const qr = runner(0);
    const migration = new RevokeBillingDeletes1792000900000();
    await migration.up(qr as never);
    await migration.down(qr as never);
    expect(qr.query.mock.calls.map(([sql]) => sql)).toEqual([
      'REVOKE DELETE ON billing_account, billing_invoices FROM "app_user"',
      'GRANT DELETE ON billing_account, billing_invoices TO "app_user"',
    ]);
  });

  it('rejects an unsafe role name', async () => {
    const previous = process.env.DB_APP_USER;
    process.env.DB_APP_USER = 'app"; DROP TABLE x; --';
    try {
      await expect(new RevokeBillingDeletes1792000900000().up(runner(0) as never)).rejects.toThrow(
        'Invalid DB_APP_USER role name',
      );
    } finally {
      if (previous === undefined) delete process.env.DB_APP_USER;
      else process.env.DB_APP_USER = previous;
    }
  });
});
