import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateListingAiSettingsDto } from './listing-ai.dto';
import { ListingAiSettingsService } from './listing-ai-settings.service';

@Controller('admin/listing-ai/settings')
@ApiTags('admin:listing-ai-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ListingAiSettingsController {
  constructor(private readonly settings: ListingAiSettingsService) {}

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser) {
    return this.settings.get(actor);
  }

  @Patch()
  update(@Body() dto: UpdateListingAiSettingsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.settings.update(dto, actor);
  }
}
