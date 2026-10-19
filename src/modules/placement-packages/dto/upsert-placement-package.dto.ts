import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  MAX_PACKAGE_FEATURES,
  MAX_PACKAGE_PRICE_UAH,
  PLACEMENT_CHANNELS,
  type PlacementChannel,
} from '../placement-channels';

/**
 * Skips validation only when the field is absent. Plain IsOptional also lets
 * an explicit `null` through, which on a NOT NULL column turns into a 500.
 */
const IsOmittable = () => ValidateIf((_object, value) => value !== undefined);

/** Trim before validating, so "  a " cannot sneak past a length check. */
const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Trimmed bullets with blank lines dropped — the admin form sends raw rows. */
const TrimList = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value
          .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
          .filter((item: unknown) => item !== '')
      : value,
  );

export class CreatePlacementPackageDto {
  @ApiProperty() @Trim() @IsString() @Length(2, 80) title!: string;

  @ApiPropertyOptional({ nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PACKAGE_PRICE_UAH)
  priceUah!: number;

  @ApiPropertyOptional({ enum: PLACEMENT_CHANNELS, isArray: true })
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(PLACEMENT_CHANNELS.length)
  @ArrayUnique()
  @IsIn(PLACEMENT_CHANNELS, { each: true })
  channels?: PlacementChannel[];

  @ApiPropertyOptional({ type: [String] })
  @TrimList()
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(MAX_PACKAGE_FEATURES)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  features?: string[];

  @ApiPropertyOptional() @IsOmittable() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional() @IsOmittable() @IsBoolean() isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOmittable()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdatePlacementPackageDto {
  @ApiPropertyOptional() @Trim() @IsOmittable() @IsString() @Length(2, 80) title?: string;

  @ApiPropertyOptional({ nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOmittable()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PACKAGE_PRICE_UAH)
  priceUah?: number;

  @ApiPropertyOptional({ enum: PLACEMENT_CHANNELS, isArray: true })
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(PLACEMENT_CHANNELS.length)
  @ArrayUnique()
  @IsIn(PLACEMENT_CHANNELS, { each: true })
  channels?: PlacementChannel[];

  @ApiPropertyOptional({ type: [String] })
  @TrimList()
  @IsOmittable()
  @IsArray()
  @ArrayMaxSize(MAX_PACKAGE_FEATURES)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  features?: string[];

  @ApiPropertyOptional() @IsOmittable() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional() @IsOmittable() @IsBoolean() isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOmittable()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
