import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        connection: redis.bullConnectionOptions,
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullRootModule {}
