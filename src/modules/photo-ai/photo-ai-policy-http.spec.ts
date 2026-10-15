import { type INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiService } from './photo-ai.service';
import { PhotoAiAccessService } from './photo-ai-access.service';
import { PhotoAiSettingsController } from './photo-ai-settings.controller';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

const ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
describe('Actual live policy HTTP enforcement', () => {
  let app: INestApplication;
  let active = true;
  let currentRole = 'editor';
  let mode = 'admins';
  let selectedEditorIds: string[] = [];
  const provider = {
    availability: jest.fn().mockResolvedValue({ enabled: false, reason: 'Unavailable' }),
  };
  const management = {
    metadata: jest.fn().mockResolvedValue({ configured: false }),
    update: jest.fn(),
  };
  beforeAll(async () => {
    const access = new PhotoAiAccessService(
      {
        findOne: async () => (active ? { id: ID, role: currentRole } : null),
        find: async () => [{ id: ID, email: 'editor@example.test' }],
      } as never,
      { findOne: async () => ({ accessMode: mode, selectedEditorIds }) } as never,
    );
    const media = {
      id: ID,
      listingId: ID,
      type: 'image',
      status: 'ready',
      aiRevision: 0,
      originalS3Key: 'original',
    };
    const repo = { manager: { findOne: async () => media }, find: async () => [] };
    const photos = new PhotoAiService(
      repo as never,
      repo as never,
      {} as never,
      provider as never,
      { publicUrlFor: () => '/original' } as never,
      {} as never,
      {} as never,
      access,
    );
    const module = await Test.createTestingModule({
      controllers: [PhotoAiController, PhotoAiSettingsController],
      providers: [
        { provide: PhotoAiService, useValue: photos },
        { provide: PhotoAiAccessService, useValue: access },
        { provide: PhotoAiCredentialsService, useValue: management },
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
          req.user = { id: ID, role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  afterEach(() => {
    currentRole = 'editor';
    active = true;
    mode = 'admins';
    selectedEditorIds = [];
  });
  it('returns permission-only workspace, independent of key availability', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/media/${ID}/photo-ai`)
      .set('Authorization', 'Bearer editor')
      .expect(200)
      .expect(({ body }) => {
        expect(body.permitted).toBe(false);
        expect(body).not.toHaveProperty('history');
        expect(body).not.toHaveProperty('enabled');
      });
    expect(provider.availability).not.toHaveBeenCalled();
    mode = 'all';
    await request(app.getHttpServer())
      .get(`/api/admin/media/${ID}/photo-ai`)
      .set('Authorization', 'Bearer editor')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ permitted: true, enabled: false }));
  });
  it('403s generation/apply/restore/presets even if JWT falsely still says admin', async () => {
    const routes = [
      {
        path: `/media/${ID}/photo-ai/generations`,
        body: { requestId: ID, category: 'scene', prompt: 'Studio scene' },
      },
      {
        path: `/media/${ID}/photo-ai/apply`,
        body: { generationId: ID, reviewed: true, expectedRevision: 0 },
      },
      { path: `/media/${ID}/photo-ai/restore`, body: { expectedRevision: 0 } },
      {
        path: '/photo-ai/presets',
        body: { category: 'scene', prompt: 'Studio scene', name: 'Studio' },
      },
    ];
    for (const role of ['editor', 'admin'])
      for (const route of routes)
        await request(app.getHttpServer())
          .post(`/api/admin${route.path}`)
          .set('Authorization', `Bearer ${role}`)
          .send(route.body)
          .expect(403);
  });
  it('checks current role for admin metadata/staff/mutations rather than stale JWT', async () => {
    for (const path of ['/api/admin/photo-ai/settings', '/api/admin/photo-ai/settings/staff'])
      await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer admin').expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({ expectedRevision: 0, accessMode: 'all' })
      .expect(403);
    expect(management.update).not.toHaveBeenCalled();
    currentRole = 'admin';
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .expect(200);
  });
  it('selected access follows current account activation, with real policy service', async () => {
    mode = 'selected';
    selectedEditorIds = [ID];
    await request(app.getHttpServer())
      .get(`/api/admin/media/${ID}/photo-ai`)
      .set('Authorization', 'Bearer editor')
      .expect(200)
      .expect(({ body }) => expect(body.permitted).toBe(true));
    active = false;
    await request(app.getHttpServer())
      .get(`/api/admin/media/${ID}/photo-ai`)
      .set('Authorization', 'Bearer editor')
      .expect(200)
      .expect(({ body }) => expect(body.permitted).toBe(false));
  });
});
