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
    const settings = await this.branding.getCurrent();
    // Deliberate allowlist: adding a private setting cannot publish it by accident.
    return {
      id: settings.id,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
      displayName: settings.displayName,
      tagline: settings.tagline,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      address: settings.address,
      workingHours: settings.workingHours,
      socialLinks: settings.socialLinks,
      seoDefaults: settings.seoDefaults,
      defaultCurrency: settings.defaultCurrency,
    };
  }
}
