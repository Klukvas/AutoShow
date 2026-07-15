import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const PHONE_REGEX = /^\+?[0-9 ()\-]{7,32}$/;

const LEAD_TYPES = {
  callback: 'callback',
  message: 'message',
  test_drive: 'test_drive',
  sell_request: 'sell_request',
  credit: 'credit',
} as const;

export class CreateLeadDto {
  @ApiProperty({ enum: Object.keys(LEAD_TYPES) })
  @IsEnum(LEAD_TYPES)
  type!: keyof typeof LEAD_TYPES;

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

  /* sell_request: the visitor's own car. Kept structured so validation is
   * strict; the service folds them into the message for the admin inbox. */

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 64) carMake?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 64) carModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  carYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  carMileageKm?: number;

  /* credit: calculator inputs at the moment of the request. */

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditDownPayment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(6)
  @Max(96)
  creditTermMonths?: number;

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
