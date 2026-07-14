import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListListingsQuery {
  @ApiPropertyOptional({ description: 'Free-text search across title, make, model and city' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() make?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fuelType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() transmission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driveType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional({ enum: ['new', 'used', 'damaged'] })
  @IsOptional()
  @IsEnum({ new: 'new', used: 'used', damaged: 'damaged' })
  condition?: 'new' | 'used' | 'damaged';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  yearMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(2100)
  yearMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileageMax?: number;

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({
    enum: ['price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc', 'newest'],
    default: 'newest',
  })
  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc', 'newest'])
  sort?: 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc' | 'mileage_asc' | 'newest';

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
