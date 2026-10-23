import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AllowWhenBillingBlocked } from '../../common/decorators/allow-when-billing-blocked.decorator';
import { InstallationService } from './installation.service';
import { InstallationHealthService } from './installation-health.service';

@Controller()
export class InstallationController {
  constructor(
    private readonly installation: InstallationService,
    private readonly health: InstallationHealthService,
  ) {}

  @Public()
  // Every SSR render reads this immutable, non-sensitive projection. A shared
  // frontend IP must not exhaust the public business-endpoint quota.
  @SkipThrottle({ global: true })
  @Get('installation')
  publicConfig() {
    return this.installation.publicConfig;
  }

  @Public()
  @Get('health')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    const checks = await this.health.check();
    if (!Object.values(checks).every(Boolean)) throw new ServiceUnavailableException('Not ready');
    return { status: 'ok' };
  }

  @Roles('admin')
  @AllowWhenBillingBlocked()
  @Get('admin/installation')
  async diagnostics() {
    return {
      ...this.installation.publicConfig,
      version: this.installation.version,
      checks: await this.health.check(),
    };
  }
}
