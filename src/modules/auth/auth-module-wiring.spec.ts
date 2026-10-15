import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { RedisService } from '../../common/redis/redis.service';
import * as queueNames from '../../workers/queue.tokens';

// Replace configuration at import time: this smoke never loads the developer's .env.
jest.mock('../../config/config.module', () => {
  const { Global, Module } = jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  const { ConfigService } = jest.requireActual<typeof import('@nestjs/config')>('@nestjs/config');
  const { EnvSchema } = jest.requireActual<typeof import('../../config/env.validation')>(
    '../../config/env.validation',
  );
  const config = {
    ...new EnvSchema(),
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DB_HOST: '127.0.0.1',
    DB_NAME: 'fixture',
    DB_APP_USER: 'fixture',
    DB_APP_PASSWORD: 'fixture',
    REDIS_HOST: '127.0.0.1',
    JWT_ACCESS_SECRET: 'fixture-access',
    JWT_REFRESH_SECRET: 'fixture-refresh',
    S3_REGION: 'fixture',
    S3_BUCKET: 'fixture',
    S3_ACCESS_KEY: 'fixture',
    S3_SECRET_KEY: 'fixture',
    S3_PUBLIC_URL: 'http://127.0.0.1/fixture',
    FX_STATIC_USD_UAH: '40',
    FX_STATIC_USD_EUR: '0.9',
    FX_STATIC_EUR_UAH: '44',
  };
  @Global()
  @Module({
    providers: [
      { provide: 'APP_CONFIG', useValue: config },
      { provide: ConfigService, useValue: new ConfigService(config) },
    ],
    exports: ['APP_CONFIG', ConfigService],
  })
  class FixtureConfigModule {}
  return { ConfigModule: FixtureConfigModule };
});

describe('actual AppModule provider wiring', () => {
  it('resolves the global and controller-local JWT guards through the real module imports', async () => {
    // Infrastructure factories are replaced before compilation; repositories/queues
    // remain module-scoped providers created by the actual production imports.
    const dataSource = {
      entityMetadatas: [],
      options: { type: 'postgres' },
      isInitialized: false,
      getRepository: jest.fn(() => ({})),
    };
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        subscriber: {},
        bullConnectionOptions: { host: '127.0.0.1', port: 1 },
      });
    for (const name of Object.values(queueNames))
      builder = builder.overrideProvider(getQueueToken(name)).useValue({});
    const module = await builder.compile();
    expect(dataSource.getRepository).toHaveBeenCalled();
    await module.close();
  });
});
