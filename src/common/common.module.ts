import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [LoggerModule, RedisModule],
  exports: [LoggerModule, RedisModule],
})
export class CommonModule {}
