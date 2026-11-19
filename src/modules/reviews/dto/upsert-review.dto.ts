import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
} from 'class-validator';

/** Same-origin photo, after decoding `%2e%2e`. Rejects traversal. An http(s) link is separate. */
function isReviewMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (/^https?:\/\/\S+$/.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  let path = value;
  for (let i = 0; i < 5; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return false;
    }
    if (decoded === path) break;
    path = decoded;
  }
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !path.includes('\0')
  );
}

export class CreateReviewDto {
  @ApiProperty() @IsString() @Length(2, 128) authorName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) city?: string;
  @ApiProperty() @IsString() @Length(10, 2000) text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsString()
  @MaxLength(512)
  @ValidateBy({ name: 'isReviewMediaUrl', validator: { validate: isReviewMediaUrl } })
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 128) authorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 2000) text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsString()
  @MaxLength(512)
  @ValidateBy({ name: 'isReviewMediaUrl', validator: { validate: isReviewMediaUrl } })
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
