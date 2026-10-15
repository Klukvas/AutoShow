import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { PhotoAiCategory } from './photo-ai.types';

export class PhotoAiPromptDto {
  @IsIn(['enhance', 'scene']) category!: PhotoAiCategory;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  prompt!: string;
}
export class GeneratePhotoAiDto extends PhotoAiPromptDto {
  @IsUUID() requestId!: string;
}
export class SavePhotoAiPresetDto extends PhotoAiPromptDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
export class PhotoAiRevisionDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
}
export class ApplyPhotoAiDto extends PhotoAiRevisionDto {
  @IsUUID() generationId!: string;
  @IsBoolean() reviewed!: boolean;
}
