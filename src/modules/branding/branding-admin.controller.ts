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
import type { SiteSettings, TelegramSettings } from './entities/site-settings.entity';

@ApiTags('admin:branding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/branding')
export class BrandingAdminController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Get current site settings' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    const settings = await this.branding.getCurrent();
    if (user.role === 'admin') return settings;
    // Editors read branding for the shell, but the bot token is a credential
    // and channel config is admin-only — strip the whole block. (Delete on a
    // fresh copy; the cached entity itself is never mutated.)
    const rest: Partial<typeof settings> = { ...settings };
    delete rest.telegram;
    return rest;
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update site settings' })
  update(@Body() dto: UpdateBrandingDto, @CurrentUser() user: AuthenticatedUser) {
    // Normalize the nested DTO (optional fields) into the entity's shape.
    const { telegram, ...rest } = dto;
    const patch: Partial<SiteSettings> = { ...rest };
    if (telegram !== undefined) {
      patch.telegram = telegram === null ? null : this.normalizeTelegram(telegram);
    }
    return this.branding.update(patch, user);
  }

  private normalizeTelegram(dto: NonNullable<UpdateBrandingDto['telegram']>): TelegramSettings {
    return {
      botToken: dto.botToken ?? null,
      channels: dto.channels.map((c) => ({
        chatId: c.chatId,
        ...(c.label ? { label: c.label } : {}),
      })),
      autoPublish: dto.autoPublish,
      // The telegram block is replaced wholesale on each PATCH, so leadChatId
      // must be carried through here — otherwise saving any telegram setting
      // silently wipes the lead-alert chat and the alerts never fire.
      leadChatId: dto.leadChatId ?? null,
    };
  }
}
