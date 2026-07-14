import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsHexColor, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertMakeDto {
  @ApiProperty() @IsString() @MaxLength(128) nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) nameEn?: string;
  @ApiProperty() @IsString() @MaxLength(64) slug!: string;
}

export class UpsertModelDto extends UpsertMakeDto {
  @ApiProperty() @IsUUID() makeId!: string;
}

export class UpsertSimpleCatalogDto {
  @ApiProperty() @IsString() @MaxLength(64) nameUk!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) nameEn?: string;
  @ApiProperty() @IsString() @MaxLength(64) slug!: string;
}

export class UpsertColorDto extends UpsertSimpleCatalogDto {
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
