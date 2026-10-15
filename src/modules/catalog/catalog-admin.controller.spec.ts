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
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
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
  it('rejects invalid IDs, whitespace names, path-like slug and arbitrary keys', async () => {
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
      { nameUk: 'Test', slug: 'test', logoS3Key: 'foreign' },
    ])
      await request(server).post('/admin/catalog/makes').send(body).expect(400);
    await request(server)
      .post(`/admin/catalog/makes/${id}/logo`)
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'test.png')
      .expect(413);
  });
});
