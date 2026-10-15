import type { PhotoAiAccessMode } from './photo-ai-access.service';
import { Transform } from 'class-transformer';
import {
  ValidateIf,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdatePhotoAiSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['admins', 'all', 'selected'])
  accessMode?: PhotoAiAccessMode;
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  selectedEditorIds?: string[];
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() removeKey?: boolean;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Matches(/^$|^[\x21-\x7e]{20,512}$/)
  apiKey?: string;
}
