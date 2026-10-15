import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  ApplyPhotoAiDto,
  GeneratePhotoAiDto,
  PhotoAiRevisionDto,
  SavePhotoAiPresetDto,
} from './photo-ai.dto';
import { PhotoAiService } from './photo-ai.service';

@Controller('admin')
@ApiTags('admin:photo-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class PhotoAiController {
  constructor(private readonly photos: PhotoAiService) {}
  @Get('media/:id/photo-ai')
  workspace(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.photos.workspace(id, actor);
  }
  @Post('media/:id/photo-ai/generations')
  @HttpCode(202)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePhotoAiDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.photos.generate(id, dto, actor);
  }
  @Post('media/:id/photo-ai/apply')
  @HttpCode(200)
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyPhotoAiDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.photos.apply(id, dto, actor);
  }
  @Post('media/:id/photo-ai/restore')
  @HttpCode(200)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PhotoAiRevisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.photos.restore(id, dto.expectedRevision, actor);
  }
  @Post('photo-ai/presets')
  savePreset(@Body() dto: SavePhotoAiPresetDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.photos.savePreset(dto, actor);
  }
}
