import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export class CreateListingDto {
  @ApiProperty() @IsUUID() makeId!: string;
  @ApiProperty() @IsUUID() modelId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) generation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) modification?: string;

  @ApiProperty() @IsInt() @Min(1900) @Max(2100) year!: number;
  @ApiProperty() @IsInt() @Min(0) mileageKm!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(VIN_REGEX, { message: 'vin must be 17 chars in the VIN alphabet' })
  vin?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() vinVisible?: boolean;

  @ApiProperty() @IsUUID() bodyTypeId!: string;
  @ApiProperty() @IsUUID() fuelTypeId!: string;
  @ApiProperty() @IsUUID() transmissionId!: string;
  @ApiProperty() @IsUUID() driveTypeId!: string;
  @ApiProperty() @IsUUID() colorId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.1)
  @Max(99.9)
  engineVolumeL!: number;

  @ApiProperty() @IsInt() @Min(1) @Max(2500) powerHp!: number;

  @ApiProperty({ enum: ['new', 'used', 'damaged'] })
  @IsEnum({ new: 'new', used: 'used', damaged: 'damaged' })
  condition!: 'new' | 'used' | 'damaged';

  @ApiProperty() @IsInt() @Min(0) @Max(30) ownersCount!: number;
  @ApiProperty() @IsBoolean() isCrashed!: boolean;
  @ApiProperty() @IsBoolean() customsCleared!: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  priceAmount!: number;

  @ApiProperty({ enum: ['USD', 'UAH', 'EUR'] })
  @IsEnum({ USD: 'USD', UAH: 'UAH', EUR: 'EUR' })
  priceCurrency!: 'USD' | 'UAH' | 'EUR';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isNegotiable?: boolean;

  /* Consignment economics (back-office only, never exposed publicly). */

  @ApiPropertyOptional({ enum: ['own', 'client'] })
  @IsOptional()
  @IsEnum({ own: 'own', client: 'client' })
  sellerType?: 'own' | 'client';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) sellerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) sellerPhone?: string;

  @ApiPropertyOptional({ enum: ['none', 'fixed', 'percent'] })
  @IsOptional()
  @IsEnum({ none: 'none', fixed: 'fixed', percent: 'percent' })
  feeType?: 'none' | 'fixed' | 'percent';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  feeFixedAmount?: number;

  @ApiProperty() @IsString() @Length(8, 255) title!: string;
  @ApiProperty() @IsString() @Length(20, 10_000) description!: string;
  @ApiProperty() @IsString() @Length(2, 128) locationCity!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) locationRegion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(320) metaDescription?: string;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds?: string[];
}
