import { PhotoAiAccessService } from './photo-ai-access.service';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { UpdatePhotoAiSettingsDto } from './photo-ai-settings.dto';

@Controller('admin/photo-ai/settings')
@ApiTags('admin:photo-ai-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PhotoAiSettingsController {
  constructor(
    private readonly credentials: PhotoAiCredentialsService,
    private readonly access: PhotoAiAccessService,
  ) {}
  @Get() async get(@CurrentUser() actor: AuthenticatedUser) {
    await this.access.requireAdmin(actor.id);
    return this.credentials.metadata();
  }
  @Get('staff') async staff(@CurrentUser() actor: AuthenticatedUser) {
    await this.access.requireAdmin(actor.id);
    return this.access.staff(actor.id);
  }
  @Patch() async update(
    @Body() dto: UpdatePhotoAiSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.access.requireAdmin(actor.id);
    return this.credentials.update(dto, actor);
  }
}
