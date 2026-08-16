import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TelegramPostService } from './telegram-post.service';

@ApiTags('admin:telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
// Editors manage listings, so they can post to channels too; the channel
// CONFIG (bot token) stays admin-only via the branding endpoint.
@Roles('admin', 'editor')
@Controller('admin/listings/:id/telegram-posts')
export class TelegramAdminController {
  constructor(
    private readonly telegram: TelegramPostService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Telegram post history for a listing' })
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.telegram.postsFor(id);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue posting the listing to the configured Telegram channels' })
  async create(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.telegram.enqueueManualPost(id);
    await this.audit.record({
      action: 'listing.telegram_post',
      entityType: 'listing',
      entityId: id,
      diff: { enqueuedChannels: result.enqueuedChannels },
      actorId: user.id,
      actorRole: user.role,
    });
    return result;
  }
}
