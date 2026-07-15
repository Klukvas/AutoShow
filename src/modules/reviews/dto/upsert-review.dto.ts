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
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty() @IsString() @Length(2, 128) authorName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) city?: string;
  @ApiProperty() @IsString() @Length(10, 2000) text!: string;

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
