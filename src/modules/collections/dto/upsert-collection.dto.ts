import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CONDITIONS = ['new', 'used', 'damaged'] as const;

export class CollectionQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) make?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) bodyType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) fuelType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) transmission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) driveType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) city?: string;
  @ApiPropertyOptional({ enum: CONDITIONS })
  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: (typeof CONDITIONS)[number];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) priceMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) priceMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) yearMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() yearMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) mileageMax?: number;
}

export class CreateCollectionDto {
  // Lowercase slug — it's the URL segment (/collections/:key) and sitemap loc.
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'key must be a lowercase slug' })
  @Length(2, 64)
  key!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(16) emoji?: string;

  @ApiProperty() @IsString() @Length(2, 160) titleUk!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) descriptionUk?: string;

  @ApiProperty({ type: CollectionQueryDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CollectionQueryDto)
  query!: CollectionQueryDto;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) position?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}
