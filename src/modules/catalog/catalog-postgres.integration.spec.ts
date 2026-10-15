import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { DataSource, IsNull } from 'typeorm';
import { ALL_ENTITIES } from '../../database/entities';
import { CatalogMakeLogoMode1792000400000 } from '../../database/migrations/1792000400000-CatalogMakeLogoMode';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogLogoService } from './catalog-logo.service';
import { MakeLogoService } from './make-logo.service';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { Listing } from '../listings/entities/listing.entity';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Explicitly opt into the isolated developer-started DB; never consume project .env.
const integration = process.env.CATALOG_TEST_PG === '1' ? describe : describe.skip;
integration('catalog real PostgreSQL CAS, parent locks and migration', () => {
  const schema = `catalog_${randomUUID().replace(/-/g, '')}`;
  const source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 55443,
    username: 'postgres',
    database: 'catalog_verify',
    schema,
    entities: ALL_ENTITIES,
    synchronize: false,
  });
  const actor = { id: randomUUID(), role: 'editor' } as AuthenticatedUser;
  const storage = {
    putBuffer: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    publicUrlFor: (key: string) => `/media/${key}`,
  };
  const cache = { invalidate: jest.fn(async () => undefined) };
  const audit = { record: jest.fn(async () => undefined) };
  let admin: CatalogAdminService;
  let logos: CatalogLogoService;
  const make = async () =>
    source
      .getRepository(Make)
      .save({ nameUk: 'Test', slug: randomUUID(), logoMode: 'auto' as const });
  beforeAll(async () => {
    await source.initialize();
    await source.query(`CREATE SCHEMA "${schema}"`);
    await source.synchronize();
    const repo = source.getRepository(Make);
    admin = new CatalogAdminService(
      repo,
      source.getRepository(Model),
      ...(Array(8).fill({}) as [never, never, never, never, never, never, never, never]),
      source.getRepository(Listing),
      cache as never,
      audit as never,
      {} as never,
      storage as never,
    );
    logos = new CatalogLogoService(repo, storage as never, cache as never, audit as never);
  });
  afterAll(async () => {
    if (source.isInitialized) await source.destroy();
  });
  it('TypeORM actually increments versions and predicates prevent stale manual and auto writes', async () => {
    const saved = await make();
    const repo = source.getRepository(Make);
    await logos.remove(saved.id, actor);
    const next = await repo.findOneByOrFail({ id: saved.id });
    expect(next.version).toBe(saved.version + 1);
    expect(next.logoMode).toBe('none');
    const stale = await repo.update(
      {
        id: saved.id,
        version: saved.version,
        deletedAt: IsNull(),
        logoMode: 'auto',
        logoS3Key: IsNull(),
      },
      { logoS3Key: 'stale.png' },
    );
    expect(stale.affected).toBe(0);
  });
  it('in-flight auto fetch loses after real manual removal', async () => {
    const saved = await make();
    let resolveIcon: (value: { buffer: Buffer; contentType: 'image/png' }) => void = () =>
      undefined;
    let signal: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const auto = new MakeLogoService(
      source.getRepository(Make),
      {
        fetchIcon: () => {
          signal();
          return new Promise((resolve) => {
            resolveIcon = resolve;
          });
        },
      } as never,
      storage as never,
      cache as never,
    );
    const running = auto.fetchLogo(saved.id);
    await started;
    await logos.remove(saved.id, actor);
    resolveIcon({
      buffer: await sharp({ create: { width: 10, height: 10, channels: 4, background: '#fff' } })
        .png()
        .toBuffer(),
      contentType: 'image/png',
    });
    await running;
    expect(await source.getRepository(Make).findOneByOrFail({ id: saved.id })).toMatchObject({
      logoMode: 'none',
      logoS3Key: null,
    });
  });
  it('createModel waits for parent lock and rejects after deletion commits', async () => {
    const saved = await make();
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.manager
      .getRepository(Make)
      .findOne({ where: { id: saved.id }, lock: { mode: 'pessimistic_write' } });
    let settled = false;
    const creating = admin
      .createModel({ makeId: saved.id, nameUk: 'Child', slug: 'child' }, actor)
      .then(
        () => 'created',
        (error) => error,
      )
      .finally(() => {
        settled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(settled).toBe(false);
    await runner.manager.getRepository(Make).softDelete(saved.id);
    await runner.commitTransaction();
    await runner.release();
    expect(await creating).toMatchObject({ status: 404 });
  });
  it('deleteMake waits for parent lock and sees a newly committed model', async () => {
    const saved = await make();
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.manager
      .getRepository(Make)
      .findOne({ where: { id: saved.id }, lock: { mode: 'pessimistic_write' } });
    let settled = false;
    const deleting = admin
      .deleteMake(saved.id, actor)
      .then(
        () => 'deleted',
        (error) => error,
      )
      .finally(() => {
        settled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(settled).toBe(false);
    await runner.manager
      .getRepository(Model)
      .save({ makeId: saved.id, nameUk: 'Child', slug: 'child' });
    await runner.commitTransaction();
    await runner.release();
    expect(await deleting).toMatchObject({ status: 409 });
    expect(
      (await source.getRepository(Make).findOneByOrFail({ id: saved.id })).deletedAt,
    ).toBeNull();
  });
  it('migration upgrades existing logo rows, preserves keys, and rolls back its own column', async () => {
    const saved = await make();
    const repo = source.getRepository(Make);
    await repo.update(saved.id, { logoS3Key: 'catalog/makes/legacy.png' });
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}",public`);
    const migration = new CatalogMakeLogoMode1792000400000();
    await migration.down(runner);
    await migration.up(runner);
    expect(await repo.findOneByOrFail({ id: saved.id })).toMatchObject({
      logoMode: 'auto',
      logoS3Key: 'catalog/makes/legacy.png',
    });
    await runner.release();
  });
});
