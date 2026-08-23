import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
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
  ValidateIf,
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

  /* Consignment economics (back-office only, never exposed publicly).
   * Cross-field rules are enforced here for POST bodies; partial PATCHes are
   * re-checked against the merged entity in ListingsService, so API clients
   * can't create a client car without a callback number or a percent/fixed
   * commission without its rate. */

  @ApiPropertyOptional({ enum: ['own', 'client'] })
  @IsOptional()
  @IsEnum({ own: 'own', client: 'client' })
  sellerType?: 'own' | 'client';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) sellerName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateListingDto) => o.sellerType === 'client' || o.sellerPhone !== undefined)
  @IsDefined({ message: 'sellerPhone is required when sellerType is client' })
  @IsString()
  @Length(5, 32)
  sellerPhone?: string;

  @ApiPropertyOptional({ enum: ['none', 'fixed', 'percent'] })
  @IsOptional()
  @IsEnum({ none: 'none', fixed: 'fixed', percent: 'percent' })
  feeType?: 'none' | 'fixed' | 'percent';

  @ApiPropertyOptional()
  @ValidateIf((o: CreateListingDto) => o.feeType === 'percent' || o.feePercent !== undefined)
  @IsDefined({ message: 'feePercent is required when feeType is percent' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  feePercent?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateListingDto) => o.feeType === 'fixed' || o.feeFixedAmount !== undefined)
  @IsDefined({ message: 'feeFixedAmount is required when feeType is fixed' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
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

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds?: string[];
}
