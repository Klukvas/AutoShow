import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  MinLength,
  Min,
} from 'class-validator';

export class UpsertMakeDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) nameEn?: string;
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}

export class UpsertModelDto extends UpsertMakeDto {
  @ApiProperty() @IsUUID() makeId!: string;
}

export class UpsertSimpleCatalogDto {
  @ApiProperty() @IsString() @MaxLength(64) nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) nameEn?: string;
  @ApiProperty() @IsString() @MaxLength(64) slug!: string;
}

// Editors add colors by name straight from the listing form, so the slug is
// optional and generated server-side when omitted.
export class UpsertColorDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) nameEn?: string;
  @ApiPropertyOptional({ description: 'Generated from nameUk when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() hex?: string;
}

export class UpsertOptionDto {
  @ApiProperty({ enum: ['comfort', 'safety', 'multimedia', 'interior', 'exterior', 'other'] })
  @IsEnum({
    comfort: 'comfort',
    safety: 'safety',
    multimedia: 'multimedia',
    interior: 'interior',
    exterior: 'exterior',
    other: 'other',
  })
  category!: 'comfort' | 'safety' | 'multimedia' | 'interior' | 'exterior' | 'other';

  @ApiProperty() @IsString() @MaxLength(128) nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) nameEn?: string;
  @ApiProperty() @IsString() @MaxLength(64) slug!: string;
}

export class UpsertTagDto {
  @ApiProperty() @IsString() @MaxLength(64) nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) nameEn?: string;
  @ApiProperty() @IsString() @MaxLength(64) slug!: string;

  @ApiPropertyOptional({ description: 'Sort order in the tag list (ascending)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ description: 'Hidden from the storefront (filter + badges) when false' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
