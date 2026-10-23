import { Global, Module } from '@nestjs/common';
import { InstallationController } from './installation.controller';
import { InstallationService } from './installation.service';
import { InstallationHealthService } from './installation-health.service';

@Global()
@Module({
  controllers: [InstallationController],
  providers: [InstallationService, InstallationHealthService],
  exports: [InstallationService],
})
export class InstallationModule {}
