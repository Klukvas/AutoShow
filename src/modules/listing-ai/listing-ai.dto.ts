import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  LISTING_AI_ACCESS_MODES,
  LISTING_AI_FIELDS,
  LISTING_AI_PRESETS,
  type ListingAiAccessMode,
  type ListingAiField,
  type ListingAiPreset,
} from './listing-ai.types';

export class CreateListingAiDraftDto {
  @IsUUID() requestId!: string;
  @IsIn(LISTING_AI_PRESETS) preset!: ListingAiPreset;
}

export class AcceptListingAiDraftDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(LISTING_AI_FIELDS, { each: true })
  fields!: ListingAiField[];
  /** Required (true) when the draft carries flags. */
  @IsBoolean() confirmFlags!: boolean;
}

export class UpdateListingAiSettingsDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(LISTING_AI_ACCESS_MODES)
  accessMode?: ListingAiAccessMode;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  selectedEditorIds?: string[];

  /** Empty or blank clears it. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  brandTone?: string;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((word: unknown) => (typeof word === 'string' ? word.trim() : word))
      : value,
  )
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  // Letters, digits, spaces, apostrophes and hyphens: a word or short phrase.
  @Matches(/^[\p{L}\d][\p{L}\d '\u2019\u02bc-]*$/u, { each: true })
  brandBannedWords?: string[];

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  brandExample?: string;
}
