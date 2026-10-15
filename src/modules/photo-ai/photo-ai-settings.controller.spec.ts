import { PhotoAiAccessService } from './photo-ai-access.service';
import {
  type INestApplication,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { PhotoAiSettingsController } from './photo-ai-settings.controller';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

const metadata = {
  accessMode: 'all',
  selectedEditorIds: [],
  configured: true,
  enabled: false,
  available: false,
  setupAvailable: true,
  revision: 1,
  status: 'disabled',
};
describe('Owner photo AI settings HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    metadata: jest.fn().mockResolvedValue(metadata),
    update: jest.fn().mockResolvedValue(metadata),
  };
  const access = {
    requireAdmin: jest.fn().mockResolvedValue(undefined),
    staff: jest
      .fn()
      .mockResolvedValue([
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'editor@example.test' },
      ]),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PhotoAiSettingsController],
      providers: [
        { provide: PhotoAiCredentialsService, useValue: service },
        { provide: PhotoAiAccessService, useValue: access },
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
          req.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role };
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
  afterEach(() => access.requireAdmin.mockResolvedValue(undefined));
  it('keeps metadata and mutations admin-only, denying public/editor roles', async () => {
    await request(app.getHttpServer()).get('/api/admin/photo-ai/settings').expect(401);
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .send({ expectedRevision: 1, removeKey: true })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer editor')
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer editor')
      .send({ expectedRevision: 1, removeKey: true })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(metadata);
        expect(body).not.toHaveProperty('apiKey');
        expect(body).not.toHaveProperty('encryptedKey');
      });
  });
  it('validates bounded input and strips fields outside the settings DTO', async () => {
    for (const body of [
      { expectedRevision: 1, apiKey: 'short' },
      { expectedRevision: 1, apiKey: 'x'.repeat(513) },
      { expectedRevision: 1, apiKey: 'contains newline\nand whitespace' },
      { expectedRevision: 1, enabled: 'true' },
      { enabled: true },
      { expectedRevision: 1, accessMode: null },
      { expectedRevision: 1, selectedEditorIds: null },
      { expectedRevision: 1, accessMode: 'unknown' },
      { expectedRevision: 1, selectedEditorIds: ['not-uuid'] },
      {
        expectedRevision: 1,
        selectedEditorIds: Array(201).fill('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      },
      {
        expectedRevision: 1,
        selectedEditorIds: [
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        ],
      },
    ]) {
      await request(app.getHttpServer())
        .patch('/api/admin/photo-ai/settings')
        .set('Authorization', 'Bearer admin')
        .send(body)
        .expect(400);
    }
    expect(service.update).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({ expectedRevision: 1, encryptedKey: 'ciphertext', configured: true })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      { expectedRevision: 1 },
      expect.objectContaining({ role: 'admin' }),
    );
  });
  it('blocks stale-admin metadata/staff/update and returns only safe eligible staff projection', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings/staff')
      .set('Authorization', 'Bearer editor')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings/staff')
      .set('Authorization', 'Bearer admin')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual([
          { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'editor@example.test' },
        ]),
      );
    access.requireAdmin.mockRejectedValue(new ForbiddenException('Current role is editor'));
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/photo-ai/settings/staff')
      .set('Authorization', 'Bearer admin')
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({ expectedRevision: 1, accessMode: 'all' })
      .expect(403);
  });
  it('blank credential preserves through normalized DTO, raw credential is never echoed', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({ expectedRevision: 1, enabled: false, apiKey: '   ' })
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(metadata));
    expect(service.update).toHaveBeenCalledWith(
      { expectedRevision: 1, enabled: false, apiKey: '' },
      expect.objectContaining({ role: 'admin' }),
    );
    const fake = 'fixture-owner-key-123456789';
    await request(app.getHttpServer())
      .patch('/api/admin/photo-ai/settings')
      .set('Authorization', 'Bearer admin')
      .send({ expectedRevision: 1, enabled: true, apiKey: fake })
      .expect(200)
      .expect(({ text }) => expect(text).not.toContain(fake));
  });
});
