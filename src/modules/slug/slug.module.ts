import { Global, Module } from '@nestjs/common';
import { SlugService } from './slug.service';

@Global()
@Module({
  providers: [SlugService],
  exports: [SlugService],
})
export class SlugModule {}
