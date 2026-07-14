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
  get() {
    return this.branding.getCurrent();
  }
}
