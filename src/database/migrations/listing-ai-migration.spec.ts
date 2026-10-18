import { ListingAi1792001200000 } from './1792001200000-ListingAi';

const originalRole = process.env.DB_APP_USER;
beforeEach(() => {
  process.env.DB_APP_USER = 'app_user';
});
afterAll(() => {
  if (originalRole === undefined) delete process.env.DB_APP_USER;
  else process.env.DB_APP_USER = originalRole;
});

const statementsOf = (qr: { query: jest.Mock }) =>
  qr.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

describe('ListingAi migration', () => {
  it('creates the four tables, seeds only the settings singleton and never deletes data', async () => {
    const qr = { query: jest.fn() };
    await new ListingAi1792001200000().up(qr as never);
    const statements = statementsOf(qr);
    for (const table of [
      'listing_ai_generations',
      'listing_ai_settings',
      'listing_ai_balance',
      'listing_ai_ledger',
    ])
      expect(statements.some((sql) => sql.startsWith(`CREATE TABLE ${table} (`))).toBe(true);
    expect(statements).toContain('INSERT INTO listing_ai_settings (id) VALUES (1)');
    expect(statements.some((sql) => /^(DELETE|DROP|ALTER TABLE listings)/i.test(sql))).toBe(false);
    expect(
      statements.find((sql) => sql.startsWith('CREATE UNIQUE INDEX uq_listing_ai_inflight')),
    ).toContain("(listing_id, input_hash, preset) WHERE status IN ('queued','processing')");
  });

  it('keeps generations and the ledger append-only for the runtime role', async () => {
    const qr = { query: jest.fn() };
    await new ListingAi1792001200000().up(qr as never);
    const statements = statementsOf(qr);
    expect(
      statements.find((sql) => sql.startsWith('CREATE TABLE listing_ai_generations')),
    ).toContain('REFERENCES listings(id) ON DELETE CASCADE');
    for (const grant of [
      'GRANT SELECT, INSERT, UPDATE ON listing_ai_generations TO "app_user"',
      'REVOKE DELETE ON listing_ai_generations FROM "app_user"',
      'REVOKE INSERT, DELETE ON listing_ai_settings FROM "app_user"',
      'REVOKE DELETE ON listing_ai_balance FROM "app_user"',
      'REVOKE UPDATE, DELETE ON listing_ai_ledger FROM "app_user"',
    ])
      expect(statements).toContain(grant);
  });

  it('refuses to revert while description purchases or refunds exist, changing nothing', async () => {
    const qr = { query: jest.fn(async () => [{ n: 2 }]) };
    await expect(new ListingAi1792001200000().down(qr as never)).rejects.toThrow(
      '2 description purchase/refund ledger row(s) exist',
    );
    expect(qr.query).toHaveBeenCalledTimes(1);
  });

  it('drops the tables in dependency order on down()', async () => {
    const qr = {
      query: jest.fn(async (sql: string) => (sql.includes('count(*)') ? [{ n: 0 }] : undefined)),
    };
    await new ListingAi1792001200000().down(qr as never);
    expect(statementsOf(qr).filter((sql) => sql.startsWith('DROP'))).toEqual([
      'DROP TABLE listing_ai_ledger',
      'DROP TABLE listing_ai_balance',
      'DROP TABLE listing_ai_settings',
      'DROP TABLE listing_ai_generations',
    ]);
  });

  it('rejects an unsafe role name before running anything', async () => {
    process.env.DB_APP_USER = 'app"; DROP TABLE x; --';
    const qr = { query: jest.fn() };
    await expect(new ListingAi1792001200000().up(qr as never)).rejects.toThrow(
      'Invalid DB_APP_USER role name',
    );
    expect(qr.query).not.toHaveBeenCalled();
  });
});
