import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { PhotoAiCredits1792000800000 } from '../../database/migrations/1792000800000-PhotoAiCredits';
import {
  creditPack,
  ensureBalance,
  readBalance,
  refundPack,
  needsBalanceSetup,
  reservePhoto,
  settlePhoto,
  unsettledGenerations,
} from './photo-credits.store';

/**
 * Runs the real SQL of the photo-credit store against PostgreSQL (row locks,
 * partial unique indexes, concurrent transactions). Needs a disposable
 * database: PHOTO_CREDITS_TEST_PG_URL=postgres://user:pass@host:port/db
 * Tables are created from the real migration on top of minimal stand-ins.
 */
const url = process.env.PHOTO_CREDITS_TEST_PG_URL;
const integration = url ? describe : describe.skip;

integration('photo credit store on PostgreSQL', () => {
  let db: DataSource;

  beforeAll(async () => {
    db = await new DataSource({ type: 'postgres', url, poolSize: 4 }).initialize();
    await db.query(`DROP TABLE IF EXISTS photo_ai_ledger, photo_ai_balance, photo_ai_generations,
      billing_invoices CASCADE`);
    await db.query(
      `DO $$ BEGIN CREATE ROLE photo_credits_app; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    // Minimal stand-ins for tables owned by earlier migrations.
    await db.query(`CREATE TABLE billing_invoices (id uuid PRIMARY KEY, invoice_id varchar(64),
      period_months smallint NOT NULL)`);
    await db.query(
      `CREATE TABLE photo_ai_generations (id uuid PRIMARY KEY, status varchar(20) NOT NULL)`,
    );
    process.env.DB_APP_USER = 'photo_credits_app';
    await new PhotoAiCredits1792000800000().up(db.createQueryRunner());
  });

  beforeEach(async () => {
    await db.query(`TRUNCATE photo_ai_ledger, photo_ai_balance, photo_ai_generations`);
  });

  afterAll(async () => {
    await db?.query(`DROP TABLE IF EXISTS photo_ai_ledger, photo_ai_balance, photo_ai_generations,
      billing_invoices CASCADE`);
    await db?.query(`DROP ROLE IF EXISTS photo_credits_app`);
    await db?.destroy();
  });

  const tx = <T>(fn: (em: EntityManager) => Promise<T>): Promise<T> => db.transaction(fn);
  const balance = () => readBalance(db.manager);
  const ledgerCount = async (type: string) =>
    Number(
      (
        (await db.query(`SELECT count(*)::int AS n FROM photo_ai_ledger WHERE entry_type = $1`, [
          type,
        ])) as Array<{ n: number }>
      )[0].n,
    );

  it('grants the free starter photos exactly once', async () => {
    await tx((em) => ensureBalance(em, 3));
    await tx((em) => ensureBalance(em, 3));
    await tx((em) => ensureBalance(em, 10)); // a later env change grants nothing more
    expect(await balance()).toMatchObject({ credited: 3, available: 3 });
    expect(await ledgerCount('free_grant')).toBe(1);
  });

  it('needs setup only until the row exists and the configured grant is done', async () => {
    expect(await needsBalanceSetup(db.manager, 0)).toBe(true); // no row yet
    await tx((em) => ensureBalance(em, 0));
    expect(await needsBalanceSetup(db.manager, 0)).toBe(false);
    expect(await needsBalanceSetup(db.manager, 3)).toBe(true); // grant pending
    await tx((em) => ensureBalance(em, 3));
    expect(await needsBalanceSetup(db.manager, 3)).toBe(false);
  });

  it('does not mark the grant as done while no free photos are configured', async () => {
    await tx((em) => ensureBalance(em, 0));
    await tx((em) => ensureBalance(em, 2));
    expect(await balance()).toMatchObject({ credited: 2 });
  });

  it('lets only one of two concurrent jobs take the last photo', async () => {
    await tx((em) => ensureBalance(em, 1));
    const actor = randomUUID();
    const results = await Promise.all(
      [randomUUID(), randomUUID()].map((generationId) =>
        tx((em) => reservePhoto(em, generationId, actor)),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await balance()).toMatchObject({ reserved: 1, available: 0 });
    expect(await ledgerCount('reserve')).toBe(1);
  });

  it('consumes or releases a reservation exactly once', async () => {
    await tx((em) => ensureBalance(em, 2));
    const [ok, failed] = [randomUUID(), randomUUID()];
    await tx((em) => reservePhoto(em, ok, randomUUID()));
    await tx((em) => reservePhoto(em, failed, randomUUID()));

    expect(await tx((em) => settlePhoto(em, ok, 'consume'))).toBe(true);
    expect(await tx((em) => settlePhoto(em, ok, 'consume'))).toBe(false);
    expect(await tx((em) => settlePhoto(em, ok, 'release'))).toBe(false);
    expect(await tx((em) => settlePhoto(em, failed, 'release'))).toBe(true);
    expect(await tx((em) => settlePhoto(em, randomUUID(), 'consume'))).toBe(false);

    expect(await balance()).toEqual({ credited: 2, reserved: 0, consumed: 1, available: 1 });
  });

  it('credits a pack once per invoice and refunds it once, even below zero', async () => {
    await tx((em) => ensureBalance(em, 0));
    expect(await tx((em) => creditPack(em, 'p2_pack', 10, null))).toBe(true);
    expect(await tx((em) => creditPack(em, 'p2_pack', 10, null))).toBe(false);
    for (let i = 0; i < 8; i += 1) {
      const id = randomUUID();
      await tx((em) => reservePhoto(em, id, randomUUID()));
      await tx((em) => settlePhoto(em, id, 'consume'));
    }
    expect(await tx((em) => refundPack(em, 'p2_pack', 10, null))).toBe(true);
    expect(await tx((em) => refundPack(em, 'p2_pack', 10, null))).toBe(false);

    expect(await balance()).toEqual({ credited: 0, reserved: 0, consumed: 8, available: -8 });
    expect(await tx((em) => reservePhoto(em, randomUUID(), randomUUID()))).toBe(false);
  });

  it('finds reservations of finished or vanished generations for the recovery sweep', async () => {
    await tx((em) => ensureBalance(em, 4));
    const [ready, failed, running, gone] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    for (const [id, status] of [
      [ready, 'ready'],
      [failed, 'failed'],
      [running, 'processing'],
    ])
      await db.query(`INSERT INTO photo_ai_generations (id, status) VALUES ($1, $2)`, [id, status]);
    for (const id of [ready, failed, running, gone])
      await tx((em) => reservePhoto(em, id, randomUUID()));

    const open = await unsettledGenerations(db.manager, 10);
    expect(new Map(open.map((o) => [o.generationId, o.outcome]))).toEqual(
      new Map([
        [ready, 'consume'],
        [failed, 'release'],
        [gone, 'release'],
      ]),
    );
  });

  it('keeps totals derivable from the ledger', async () => {
    await tx((em) => ensureBalance(em, 2));
    await tx((em) => creditPack(em, 'p2_a', 5, null));
    const [a, b] = [randomUUID(), randomUUID()];
    await tx((em) => reservePhoto(em, a, randomUUID()));
    await tx((em) => reservePhoto(em, b, randomUUID()));
    await tx((em) => settlePhoto(em, a, 'consume'));

    const derived = (
      (await db.query(`SELECT
        COALESCE(SUM(photos) FILTER (WHERE entry_type IN ('free_grant','purchase')), 0)
          - COALESCE(SUM(photos) FILTER (WHERE entry_type = 'refund'), 0) AS credited,
        COALESCE(SUM(photos) FILTER (WHERE entry_type = 'reserve'), 0)
          - COALESCE(SUM(photos) FILTER (WHERE entry_type IN ('consume','release')), 0) AS reserved,
        COALESCE(SUM(photos) FILTER (WHERE entry_type = 'consume'), 0) AS consumed
        FROM photo_ai_ledger`)) as Array<Record<string, string>>
    )[0];
    const totals = await balance();
    expect(Number(derived.credited)).toBe(totals.credited);
    expect(Number(derived.reserved)).toBe(totals.reserved);
    expect(Number(derived.consumed)).toBe(totals.consumed);
  });
});
