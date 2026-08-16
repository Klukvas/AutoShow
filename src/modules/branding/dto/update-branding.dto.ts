import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CURRENCIES, type Currency } from '../../../common/types/currency';
import type { SeoDefaults, SocialLinks, WorkingHours } from '../entities/site-settings.entity';

export class TelegramChannelDto {
  @ApiPropertyOptional({ description: '@channelname or a numeric chat id (-100…)' })
  @IsString()
  @Matches(/^(@[A-Za-z0-9_]{4,32}|-?\d{1,20})$/, {
    message: 'chatId must be @channelname or a numeric chat id',
  })
  chatId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) label?: string;
}

export class TelegramSettingsDto {
  // BotFather token shape (digits:secret) — catches pasted URLs/garbage early,
  // before a queue job fails against the Telegram API.
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{6,12}:[A-Za-z0-9_-]{30,64}$/, {
    message: 'botToken must be a BotFather token (digits:secret)',
  })
  botToken?: string | null;

  @ApiPropertyOptional({ type: [TelegramChannelDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TelegramChannelDto)
  channels!: TelegramChannelDto[];

  @ApiPropertyOptional() @IsBoolean() autoPublish!: boolean;

  /** Manager chat for new-lead alerts (@name or numeric id); null clears it. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^(@[A-Za-z0-9_]{4,32}|-?\d{1,20})$/, {
    message: 'leadChatId must be @channelname or a numeric chat id',
  })
  leadChatId?: string | null;
}

export class UpdateBrandingDto {
  // http(s) only — a stored javascript:/data: URI would become a DOM
  // injection vector wherever the value is rendered as src/href.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(512)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(512)
  faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() accentColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) tagline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(254) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(512) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() workingHours?: WorkingHours;
  @ApiPropertyOptional() @IsOptional() @IsObject() socialLinks?: SocialLinks;
  @ApiPropertyOptional() @IsOptional() @IsObject() seoDefaults?: SeoDefaults;
  @ApiPropertyOptional({ enum: CURRENCIES })
  @IsOptional()
  @IsIn(CURRENCIES)
  defaultCurrency?: Currency;

  /** `null` clears the whole Telegram config (feature back to dormant). */
  @ApiPropertyOptional({ type: TelegramSettingsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramSettingsDto)
  telegram?: TelegramSettingsDto | null;
}
