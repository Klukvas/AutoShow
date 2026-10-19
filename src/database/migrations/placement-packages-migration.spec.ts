import { PlacementPackages1792001400000 } from './1792001400000-PlacementPackages';

const statementsOf = (qr: { query: jest.Mock }) =>
  qr.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

describe('PlacementPackages migration', () => {
  it('creates the table with its guards and never touches existing data', async () => {
    const qr = { query: jest.fn() };
    await new PlacementPackages1792001400000().up(qr as never);
    const statements = statementsOf(qr);

    const create = statements.find((sql) => sql.startsWith('CREATE TABLE "placement_packages"'));
    expect(create).toContain('CHECK (price_uah >= 0)');
    expect(create).toContain('CHECK (cardinality(features) <= 8)');
    expect(create).toContain(
      "channels <@ ARRAY['site', 'instagram_post', 'instagram_story', 'telegram', 'tiktok']",
    );
    expect(statements.some((sql) => /^(DELETE|DROP|ALTER TABLE)/i.test(sql))).toBe(false);
  });

  it('ships the starter templates hidden, so a deploy never publishes example prices', async () => {
    const qr = { query: jest.fn() };
    await new PlacementPackages1792001400000().up(qr as never);
    const inserts = qr.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'));

    expect(inserts).toHaveLength(4);
    for (const [sql] of inserts) expect(String(sql)).toMatch(/\$6, false, \$7\)/);
    const titles = inserts.map(([, params]) => (params as unknown[])[0]);
    expect(titles).toEqual(['Instagram', 'Instagram + історія', 'Telegram', 'Усі канали']);
    const positions = inserts.map(([, params]) => (params as unknown[])[6]);
    expect(positions).toEqual([0, 1, 2, 3]);
  });
});
