import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@ApiTags('admin:branding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/branding')
export class BrandingAdminController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Get current site settings' })
  get() {
    return this.branding.getCurrent();
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update site settings' })
  update(@Body() dto: UpdateBrandingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.branding.update(dto, user);
  }
}
