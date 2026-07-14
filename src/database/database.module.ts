import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvSchema } from '../config/env.validation';
import { ALL_ENTITIES } from './entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvSchema, true>) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        database: config.getOrThrow<string>('DB_NAME'),
        username: config.getOrThrow<string>('DB_APP_USER'),
        password: config.getOrThrow<string>('DB_APP_PASSWORD'),
        entities: ALL_ENTITIES,
        synchronize: false,
        autoLoadEntities: false,
        extra: { max: 20 },
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
