import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { validateEnv } from '../../config/env.validation';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ReviewsAdminController } from '../reviews/reviews-admin.controller';
import { ReviewsPublicController } from '../reviews/reviews-public.controller';
import { ReviewsService } from '../reviews/reviews.service';
import { FeatureGuard } from './feature.guard';
import { InstallationService } from './installation.service';
import { InstallationController } from './installation.controller';
import { InstallationHealthService } from './installation-health.service';

const example = parse(readFileSync('.env.example', 'utf8'));

describe('Installation contract', () => {
  it('preserves the default presentation/feature and freezes the public allowlist', () => {
    const service = new InstallationService(validateEnv(example));
    expect(service.publicConfig).toEqual({
      installationId: 'autoflow',
      themeId: 'current',
      fontPreset: 'default',
      features: { reviews: true },
    });
    expect(Object.isFrozen(service.publicConfig.features)).toBe(true);
    expect(JSON.stringify(service.publicConfig)).not.toMatch(
      /SECRET|PASSWORD|DB_|S3_|MONOBANK|telegram/,
    );
  });
  it('keeps two operator configurations independent', () => {
    const first = new InstallationService(
      validateEnv({
        ...example,
        INSTALLATION_ID: 'dealer-a',
        FEATURE_REVIEWS: 'false',
        STOREFRONT_THEME: 'compact',
        STOREFRONT_FONT_PRESET: 'system',
      }),
    );
    const second = new InstallationService(
      validateEnv({ ...example, INSTALLATION_ID: 'dealer-b' }),
    );
    expect(first.publicConfig.features.reviews).toBe(false);
    expect(first.publicConfig.themeId).toBe('compact');
    expect(second.publicConfig.features.reviews).toBe(true);
    expect(second.publicConfig.installationId).toBe('dealer-b');
  });
  it.each([
    { FEATURE_REVIEWS: 'yes' },
    { STOREFRONT_THEME: 'custom' },
    { STOREFRONT_FONT_PRESET: 'url(https://evil)' },
    { INSTALLATION_ID: '../other' },
    { APP_VERSION: 'invalid version' },
  ])('rejects malformed operator input %j', (override) => {
    expect(() => validateEnv({ ...example, ...override })).toThrow();
  });
});

describe.each([true, false])('Reviews API operator flag enabled=%s', (enabled) => {
  let app: INestApplication;
  const reviews = {
    listPublished: jest.fn(() => []),
    listAll: jest.fn(() => []),
    create: jest.fn(() => ({ id: 'created' })),
    update: jest.fn(() => ({ id: 'updated' })),
    remove: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewsPublicController, ReviewsAdminController, InstallationController],
      providers: [
        InstallationService,
        {
          provide: 'APP_CONFIG',
          useValue: validateEnv({ ...example, FEATURE_REVIEWS: String(enabled) }),
        },
        { provide: ReviewsService, useValue: reviews },
        {
          provide: InstallationHealthService,
          useValue: { check: async () => ({ database: true }) },
        },
        { provide: APP_GUARD, useClass: FeatureGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ user: object }>().user = {
            id: 'test-admin',
            role: 'admin',
            email: 'admin@example.test',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('serves only the safe public DTO', async () => {
    const res = await request(app.getHttpServer()).get('/installation').expect(200);
    expect(res.body.features.reviews).toBe(enabled);
    expect(Object.keys(res.body).sort()).toEqual([
      'features',
      'fontPreset',
      'installationId',
      'themeId',
    ]);
  });
  it('gates direct public GET', async () => {
    await request(app.getHttpServer())
      .get('/reviews')
      .expect(enabled ? 200 : 404);
  });
  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'gates direct admin %s independently from UI',
    async (method) => {
      const path = ['patch', 'delete'].includes(method)
        ? '/admin/reviews/8a82d659-9b43-4158-a888-ff1985226ae0'
        : '/admin/reviews';
      const response = await request(app.getHttpServer())
        [method](path)
        .send({ authorName: 'Dealer', text: 'A useful customer review' });
      expect(response.status).toBe(
        enabled ? (method === 'post' ? 201 : method === 'delete' ? 204 : 200) : 404,
      );
    },
  );
});

describe('SSR installation configuration throttle boundary', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 120 }])],
      controllers: [InstallationController],
      providers: [
        InstallationService,
        { provide: 'APP_CONFIG', useValue: validateEnv(example) },
        {
          provide: InstallationHealthService,
          useValue: { check: async () => ({ database: true }) },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  it('serves more than 120 immutable config reads from the frontend IP while business routes stay throttled', async () => {
    for (let attempt = 0; attempt < 125; attempt += 1) {
      await request(app.getHttpServer()).get('/installation').expect(200);
    }
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await request(app.getHttpServer()).get('/health').expect(200);
    }
    await request(app.getHttpServer()).get('/health').expect(429);
  });
});
