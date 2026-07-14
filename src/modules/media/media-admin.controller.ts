import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CreateMediaDto } from './dto/create-media.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { MediaService } from './media.service';

@ApiTags('admin:media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
@Controller('admin')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Post('listings/:listingId/media')
  @ApiOperation({ summary: 'Create media row in pending state and return presigned PUT URL' })
  begin(@Param('listingId', ParseUUIDPipe) listingId: string, @Body() dto: CreateMediaDto) {
    return this.media.beginUpload(listingId, dto);
  }

  @Post('media/:id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm upload; enqueues worker to generate renditions' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.media.confirm(id, user);
  }

  @Patch('listings/:listingId/media/reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reorder media of a listing' })
  async reorder(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReorderMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.media.reorder(listingId, dto.ids, user);
  }

  @Patch('listings/:listingId/media/:mediaId/cover')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark media as cover image' })
  async cover(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.media.setCover(listingId, mediaId, user);
  }

  @Delete('media/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete media and remove its objects from storage' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.media.remove(id, user);
  }
}
