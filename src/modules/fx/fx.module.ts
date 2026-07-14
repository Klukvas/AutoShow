import { Global, Module } from '@nestjs/common';
import { FxRateProvider } from './fx-rate.provider';

@Global()
@Module({
  providers: [FxRateProvider],
  exports: [FxRateProvider],
})
export class FxModule {}
