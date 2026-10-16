import 'reflect-metadata';
import { ValidationPipe, type INestApplication, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogLogoService } from './catalog-logo.service';

const id = '6ab01d93-44d8-432c-834a-79c082e278ea';
describe('catalog editor HTTP permissions and validation', () => {
  let app: INestApplication;
  const admin = {
    listMakes: jest.fn(() => []),
    listModels: jest.fn(() => []),
    createMake: jest.fn(() => ({})),
    updateMake: jest.fn(() => ({})),
    createModel: jest.fn(() => ({})),
    updateModel: jest.fn(() => ({})),
    deleteMake: jest.fn(),
    deleteModel: jest.fn(),
    createColor: jest.fn(() => ({})),
    createBodyType: jest.fn(() => ({})),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CatalogAdminController],
      providers: [
        { provide: CatalogAdminService, useValue: admin },
        {
          provide: CatalogLogoService,
          useValue: { upload: () => ({}), remove: () => ({ logoUrl: null }) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id, role: req.headers['x-test-role'] ?? 'editor' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Same options as the APP_PIPE in src/app.module.ts: unknown keys are stripped.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  it('lets editors list/create/edit makes/models and upload/remove logos', async () => {
    const server = app.getHttpServer();
    await request(server).get('/admin/catalog/makes').expect(200);
    await request(server).get('/admin/catalog/models').expect(200);
    for (const kind of ['makes', 'models']) {
      const body = { nameUk: 'Test', slug: 'test', ...(kind === 'models' ? { makeId: id } : {}) };
      await request(server).post(`/admin/catalog/${kind}`).send(body).expect(201);
      await request(server).patch(`/admin/catalog/${kind}/${id}`).send(body).expect(200);
      await request(server).delete(`/admin/catalog/${kind}/${id}`).expect(403);
      await request(server)
        .delete(`/admin/catalog/${kind}/${id}`)
        .set('x-test-role', 'admin')
        .expect(204);
    }
    await request(server)
      .post(`/admin/catalog/makes/${id}/logo`)
      .attach('file', Buffer.from('fake'), 'test.png')
      .expect(201);
    await request(server).delete(`/admin/catalog/makes/${id}/logo`).expect(200);
  });
  it('rejects invalid IDs, whitespace names and path-like slug; strips arbitrary keys', async () => {
    const server = app.getHttpServer();
    await request(server).get('/admin/catalog/models?makeId=bad').expect(400);
    await request(server)
      .patch('/admin/catalog/makes/bad')
      .send({ nameUk: 'Test', slug: 'test' })
      .expect(400);
    for (const body of [
      { nameUk: '   ', slug: 'test' },
      { nameUk: null, slug: 'test' },
      { nameUk: 'Test', slug: '../owned' },
    ])
      await request(server).post('/admin/catalog/makes').send(body).expect(400);
    await request(server)
      .post('/admin/catalog/makes')
      .send({ nameUk: 'Test', slug: 'test', logoS3Key: 'foreign' })
      .expect(201);
    expect(admin.createMake).toHaveBeenLastCalledWith(
      { nameUk: 'Test', slug: 'test' },
      expect.anything(),
    );
    await request(server)
      .post(`/admin/catalog/makes/${id}/logo`)
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'test.png')
      .expect(413);
  });
  it('lets editors add a color by name only, keeping other dictionaries admin-only', async () => {
    const server = app.getHttpServer();
    await request(server).post('/admin/catalog/colors').send({ nameUk: 'Бежевий' }).expect(201);
    expect(admin.createColor).toHaveBeenLastCalledWith(
      { nameUk: 'Бежевий' },
      expect.objectContaining({ role: 'editor' }),
    );
    await request(server).post('/admin/catalog/colors').send({ nameUk: '  Бежевий  ' }).expect(201);
    expect(admin.createColor).toHaveBeenLastCalledWith({ nameUk: 'Бежевий' }, expect.anything());
    const simple = { nameUk: 'Купе', slug: 'coupe' };
    await request(server).post('/admin/catalog/body-types').send(simple).expect(403);
    await request(server)
      .post('/admin/catalog/body-types')
      .set('x-test-role', 'admin')
      .send(simple)
      .expect(201);
  });
  it('rejects blank, overlong or malformed color input', async () => {
    const server = app.getHttpServer();
    const calls = admin.createColor.mock.calls.length;
    for (const body of [
      {},
      { nameUk: '   ' },
      { nameUk: 'x'.repeat(65) },
      { nameUk: 'Бежевий', slug: '../owned' },
      { nameUk: 'Бежевий', hex: 'beige' },
    ])
      await request(server).post('/admin/catalog/colors').send(body).expect(400);
    expect(admin.createColor.mock.calls.length).toBe(calls);
  });
  it('passes only the name for editors but keeps admin-supplied color fields', async () => {
    const server = app.getHttpServer();
    const full = { nameUk: 'Бежевий', nameEn: 'Beige', slug: 'beige', hex: '#D8C8A8' };
    await request(server)
      .post('/admin/catalog/colors')
      .send({ ...full, listingId: id })
      .expect(201);
    expect(admin.createColor).toHaveBeenLastCalledWith(
      { nameUk: 'Бежевий' },
      expect.objectContaining({ role: 'editor' }),
    );
    await request(server)
      .post('/admin/catalog/colors')
      .set('x-test-role', 'admin')
      .send({ ...full, listingId: id })
      .expect(201);
    expect(admin.createColor).toHaveBeenLastCalledWith(
      full,
      expect.objectContaining({ role: 'admin' }),
    );
  });
});
