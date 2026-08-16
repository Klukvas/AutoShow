import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BrandingService } from './branding.service';

@ApiTags('branding')
@Public()
@Controller('branding')
export class BrandingPublicController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @ApiOperation({ summary: 'Site branding for the storefront' })
  async get() {
    // The telegram block holds the bot token — a live credential that must
    // never reach the public endpoint. (Delete on a fresh copy; the cached
    // entity itself is never mutated.)
    const settings: Partial<Awaited<ReturnType<BrandingService['getCurrent']>>> = {
      ...(await this.branding.getCurrent()),
    };
    delete settings.telegram;
    return settings;
  }
}
