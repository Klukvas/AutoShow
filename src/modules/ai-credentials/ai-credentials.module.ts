import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCredentialsService } from './ai-credentials.service';
import { AiCredentials } from './entities/ai-credentials.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiCredentials])],
  providers: [AiCredentialsService],
  exports: [AiCredentialsService],
})
export class AiCredentialsModule {}
