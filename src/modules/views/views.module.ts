import { Global, Module } from '@nestjs/common';
import { ViewCounterService } from './view-counter.service';

@Global()
@Module({
  providers: [ViewCounterService],
  exports: [ViewCounterService],
})
export class ViewsModule {}
