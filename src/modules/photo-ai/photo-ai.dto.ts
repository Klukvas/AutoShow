import {
  IsBoolean,
  IsIn,
  IsOptional,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BUILTIN_PHOTO_PRESETS } from './photo-ai.prompts';
import type { PhotoAiCategory } from './photo-ai.types';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PhotoAiPromptDto {
  @IsIn(['enhance', 'scene']) category!: PhotoAiCategory;
  @Transform(trimmed)
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  prompt!: string;
}
/** A builtin preset may run with no wishes; an owner's own instruction needs 5+ characters. */
@ValidatorConstraint({ name: 'promptForPreset' })
class PromptForPreset implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const hasPreset = Boolean((args.object as GeneratePhotoAiDto).presetId);
    if (value === undefined) return hasPreset;
    return typeof value === 'string' && value.length <= 4000 && (hasPreset || value.length >= 5);
  }
  defaultMessage(): string {
    return 'prompt must be 5-4000 characters, or up to 4000 alongside a presetId';
  }
}

/**
 * Either a builtin preset (by id, optional owner wishes in `prompt`) or the
 * owner's own instruction in `prompt`.
 */
export class GeneratePhotoAiDto {
  @IsUUID() requestId!: string;
  @IsIn(['enhance', 'scene']) category!: PhotoAiCategory;
  @IsOptional()
  @IsIn(BUILTIN_PHOTO_PRESETS.map((preset) => preset.id))
  presetId?: string;
  @Transform(trimmed)
  @Validate(PromptForPreset)
  prompt?: string;
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
