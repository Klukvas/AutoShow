import { AiCredentials1792001000000 } from './1792001000000-AiCredentials';

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

describe('AiCredentials migration', () => {
  it('copies the key, leaves the old column for the running app, and grants only read/update', async () => {
    const qr = { query: jest.fn() };
    await new AiCredentials1792001000000().up(qr as never);
    const statements = statementsOf(qr);
    const copy = statements.find((sql) => sql.startsWith('INSERT INTO ai_credentials'));
    expect(copy).toContain('SELECT encrypted_key FROM photo_ai_settings WHERE id = 1');
    // Expand-only: the old app still reads photo_ai_settings during the deploy.
    expect(statements.some((sql) => sql.startsWith('UPDATE photo_ai_settings'))).toBe(false);
    expect(statements).toContain('GRANT SELECT, UPDATE ON ai_credentials TO "app_user"');
    expect(statements).toContain('REVOKE INSERT, DELETE ON ai_credentials FROM "app_user"');
    expect(statements.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
  });

  it('copies the current key back before dropping the table on down()', async () => {
    const qr = { query: jest.fn() };
    await new AiCredentials1792001000000().down(qr as never);
    const statements = statementsOf(qr);
    expect(statements[0]).toMatch(/^UPDATE photo_ai_settings SET encrypted_key = \(SELECT/);
    expect(statements[1]).toBe('DROP TABLE ai_credentials');
  });

  it('rejects an unsafe role name before running anything', async () => {
    process.env.DB_APP_USER = 'app"; DROP TABLE x; --';
    const qr = { query: jest.fn() };
    await expect(new AiCredentials1792001000000().up(qr as never)).rejects.toThrow(
      'Invalid DB_APP_USER role name',
    );
    expect(qr.query).not.toHaveBeenCalled();
  });
});
