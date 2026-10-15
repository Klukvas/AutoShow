import { type INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PhotoAiController } from './photo-ai.controller';
import { PhotoAiService } from './photo-ai.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
describe('PhotoAiController HTTP contract', () => {
  let app: INestApplication;
  const service = {
    workspace: jest
      .fn()
      .mockResolvedValue({ enabled: false, reason: 'Обробка ШІ поки недоступна.' }),
    generate: jest.fn().mockResolvedValue({ id, status: 'queued' }),
    apply: jest.fn().mockResolvedValue({ revision: 1 }),
    restore: jest.fn().mockResolvedValue({ revision: 2 }),
    savePreset: jest.fn().mockResolvedValue({ id }),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [PhotoAiController],
      providers: [{ provide: PhotoAiService, useValue: service }, RolesGuard, Reflector],
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  it('requires authorization and both allowed roles can view availability', async () => {
    await request(app.getHttpServer()).get(`/api/admin/media/${id}/photo-ai`).expect(401);
    await request(app.getHttpServer())
      .get(`/api/admin/media/${id}/photo-ai`)
      .set('Authorization', 'Bearer viewer')
      .expect(403);
    for (const role of ['admin', 'editor'])
      await request(app.getHttpServer())
        .get(`/api/admin/media/${id}/photo-ai`)
        .set('Authorization', `Bearer ${role}`)
        .expect(200)
        .expect(({ body }) => expect(body.enabled).toBe(false));
  });
  it('validates identifiers, bounded prompts and category before queueing', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/media/not-uuid/photo-ai')
      .set('Authorization', 'Bearer editor')
      .expect(400);
    for (const body of [
      { requestId: id, category: 'scene', prompt: 'x' },
      { requestId: id, category: 'scene', prompt: 'x'.repeat(4001) },
      { requestId: id, category: 'unknown', prompt: 'Studio' },
      { requestId: id, category: 'scene', prompt: 'Studio', sourceUrl: 'http://internal' },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/admin/media/${id}/photo-ai/generations`)
        .set('Authorization', 'Bearer editor')
        .send(body)
        .expect(400);
    }
    expect(service.generate).not.toHaveBeenCalled();
  });
  it('queues validated generation and uses the authenticated actor', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/media/${id}/photo-ai/generations`)
      .set('Authorization', 'Bearer editor')
      .send({ requestId: id, category: 'scene', prompt: ' Studio scene ' })
      .expect(202);
    expect(service.generate).toHaveBeenCalledWith(
      id,
      { requestId: id, category: 'scene', prompt: 'Studio scene' },
      expect.objectContaining({ role: 'editor' }),
    );
  });
  it('requires apply review boolean/revision and exposes apply/restore/preset routes', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/media/${id}/photo-ai/apply`)
      .set('Authorization', 'Bearer editor')
      .send({ generationId: id, expectedRevision: -1, reviewed: true })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/media/${id}/photo-ai/apply`)
      .set('Authorization', 'Bearer editor')
      .send({ generationId: id, expectedRevision: 0, reviewed: true })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/admin/media/${id}/photo-ai/restore`)
      .set('Authorization', 'Bearer editor')
      .send({ expectedRevision: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/admin/photo-ai/presets')
      .set('Authorization', 'Bearer editor')
      .send({ name: 'My studio', category: 'scene', prompt: 'Bright studio' })
      .expect(201);
  });
});
