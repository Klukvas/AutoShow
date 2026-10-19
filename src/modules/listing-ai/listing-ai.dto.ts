import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
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
}
