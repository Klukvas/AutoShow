import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CURRENCIES, type Currency } from '../../../common/types/currency';
import type { SeoDefaults, SocialLinks, WorkingHours } from '../entities/site-settings.entity';

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
}
