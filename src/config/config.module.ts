import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { EnvSchema, validateEnv } from './env.validation';

export type AppConfig = EnvSchema;

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: 'APP_CONFIG',
      useFactory: (config: ConfigService<EnvSchema, true>): AppConfig => {
        return Object.fromEntries(
          Object.keys(new EnvSchema())
            .concat([
              'DB_HOST',
              'DB_NAME',
              'DB_ADMIN_USER',
              'DB_ADMIN_PASSWORD',
              'DB_APP_USER',
              'DB_APP_PASSWORD',
              'REDIS_HOST',
              'JWT_ACCESS_SECRET',
              'JWT_REFRESH_SECRET',
              'S3_ENDPOINT',
              'S3_REGION',
              'S3_BUCKET',
              'S3_ACCESS_KEY',
              'S3_SECRET_KEY',
              'S3_PUBLIC_URL',
              'FX_STATIC_USD_UAH',
              'FX_STATIC_USD_EUR',
              'FX_STATIC_EUR_UAH',
              'EMAIL_FROM',
            ])
            .map((k) => [k, config.get(k as keyof EnvSchema, { infer: true })]),
        ) as AppConfig;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['APP_CONFIG'],
})
export class ConfigModule {}
