import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const PHONE_REGEX = /^\+?[0-9 ()\-]{7,32}$/;

export class CreateLeadDto {
  @ApiProperty({ enum: ['callback', 'message', 'test_drive'] })
  @IsEnum({ callback: 'callback', message: 'message', test_drive: 'test_drive' })
  type!: 'callback' | 'message' | 'test_drive';

  @ApiProperty()
  @IsString()
  @Length(2, 128)
  name!: string;

  @ApiProperty()
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a 7-32 digit phone number' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  utm?: Record<string, string>;

  /**
   * Honeypot — bots fill this hidden field; humans don't see it. It must PASS
   * validation (no MaxLength(0)) so a filled value reaches the service, which
   * silently drops it with a success-shaped response. Rejecting it here with a
   * 400 would tell bots the field is a trap.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  website?: string;
}
