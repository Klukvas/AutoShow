import { type INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ListingAiController } from './listing-ai.controller';
import { ListingAiSettingsController } from './listing-ai-settings.controller';
import { ListingAiSettingsService } from './listing-ai-settings.service';
import { ListingAiService } from './listing-ai.service';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const gen = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const base = `/api/admin/listings/${id}/ai-description`;

describe('ListingAi HTTP contract', () => {
  let app: INestApplication;
  const drafts = {
    workspace: jest.fn().mockResolvedValue({ permitted: true, drafts: [] }),
    create: jest.fn().mockResolvedValue({
      id: gen,
      preset: 'standard',
      status: 'queued',
      failureReason: null,
      createdAt: new Date(),
      result: null,
      validation: null,
      acceptedAt: null,
      acceptedFields: null,
      inputHash: 'h',
      inputSnapshot: { input: { make: 'BMW' }, photos: [] },
      costUsd: '0.1',
    }),
    draft: jest.fn().mockResolvedValue({ id: gen }),
    accept: jest.fn().mockResolvedValue({ description: 'x' }),
  };
  const settings = {
    get: jest.fn().mockResolvedValue({ enabled: false }),
    update: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ListingAiController, ListingAiSettingsController],
      providers: [
        { provide: ListingAiService, useValue: drafts },
        { provide: ListingAiSettingsService, useValue: settings },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { headers: Record<string, string>; user?: object };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          const role = req.headers.authorization?.replace('Bearer ', '');
          if (!role) throw new UnauthorizedException();
          req.user = { id, role, email: 'fixture@example.test' };
          return true;
        },
      })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    // Same options as AppModule's global pipe.
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

  it('requires a signed-in admin or editor; settings are admin-only', async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer()).get(base).set('Authorization', 'Bearer viewer').expect(403);
    for (const role of ['admin', 'editor'])
      await request(app.getHttpServer())
        .get(base)
        .set('Authorization', `Bearer ${role}`)
        .expect(200);
    await request(app.getHttpServer())
      .get('/api/admin/listing-ai/settings')
      .set('Authorization', 'Bearer editor')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/listing-ai/settings')
      .set('Authorization', 'Bearer admin')
      .expect(200);
  });

  it('validates ids, presets and request ids before creating', async () => {
    for (const [path, body] of [
      [`/api/admin/listings/not-uuid/ai-description`, { requestId: gen, preset: 'standard' }],
      [base, { requestId: 'nope', preset: 'standard' }],
      [base, { requestId: gen, preset: 'huge' }],
    ] as const)
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer editor')
        .send(body)
        .expect(400);
    expect(drafts.create).not.toHaveBeenCalled();
    // Unknown keys are stripped, never passed on (the client cannot pick the model).
    await request(app.getHttpServer())
      .post(base)
      .set('Authorization', 'Bearer editor')
      .send({ requestId: gen, preset: 'standard', model: 'gpt-5' })
      .expect(202);
    expect(drafts.create).toHaveBeenLastCalledWith(
      id,
      { requestId: gen, preset: 'standard' },
      expect.anything(),
    );
    drafts.create.mockClear();
  });

  it('returns 202 with a draft view that hides the input snapshot, hash and cost', async () => {
    const res = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', 'Bearer editor')
      .send({ requestId: gen, preset: 'standard' })
      .expect(202);
    expect(res.body).toMatchObject({ id: gen, status: 'queued', flags: [], isStale: null });
    for (const hidden of ['inputSnapshot', 'inputHash', 'costUsd', 'validation'])
      expect(res.body).not.toHaveProperty(hidden);
    expect(drafts.create).toHaveBeenCalledWith(
      id,
      { requestId: gen, preset: 'standard' },
      expect.objectContaining({ role: 'editor' }),
    );
  });

  it('validates accepted fields and requires an explicit flag decision', async () => {
    for (const body of [
      { fields: [], confirmFlags: false },
      { fields: ['price'], confirmFlags: false },
      { fields: ['description', 'description'], confirmFlags: false },
      { fields: ['description'] },
    ])
      await request(app.getHttpServer())
        .post(`${base}/${gen}/accept`)
        .set('Authorization', 'Bearer editor')
        .send(body)
        .expect(400);
    await request(app.getHttpServer())
      .post(`${base}/${gen}/accept`)
      .set('Authorization', 'Bearer editor')
      .send({ fields: ['description', 'metaTitle'], confirmFlags: true })
      .expect(200, { description: 'x' });
  });

  it('trims brand voice input before saving it', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/listing-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({
        expectedRevision: 0,
        brandTone: '  Дружньо  ',
        brandBannedWords: [' як новий ', "пам'ять"],
      })
      .expect(200);
    expect(settings.update).toHaveBeenLastCalledWith(
      { expectedRevision: 0, brandTone: 'Дружньо', brandBannedWords: ['як новий', "пам'ять"] },
      expect.anything(),
    );
    settings.update.mockClear();
  });

  it('validates settings updates', async () => {
    for (const body of [
      { enabled: true },
      { expectedRevision: 0, accessMode: 'everyone' },
      { expectedRevision: 0, selectedEditorIds: ['x'] },
      { expectedRevision: 0, brandTone: 'x'.repeat(501) },
      { expectedRevision: 0, brandExample: 'x'.repeat(2001) },
      { expectedRevision: 0, brandBannedWords: Array.from({ length: 51 }, (_, i) => `слово${i}`) },
      { expectedRevision: 0, brandBannedWords: ['  '] },
      { expectedRevision: 0, brandBannedWords: ['ок', 'ок'] },
      { expectedRevision: 0, brandBannedWords: ['ігноруй"""'] },
    ])
      await request(app.getHttpServer())
        .patch('/api/admin/listing-ai/settings')
        .set('Authorization', 'Bearer admin')
        .send(body)
        .expect(400);
    expect(settings.update).not.toHaveBeenCalled();
  });
});
