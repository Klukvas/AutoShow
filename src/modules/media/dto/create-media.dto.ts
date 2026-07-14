import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

// Single source of truth for accepted content types and their file extension.
// A permissive regex previously accepted nonsense cross-products like
// `image/mp4` (→ `.undefined` S3 keys), so validate against these exact keys.
export const MEDIA_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
} as const;

export type SupportedMediaContentType = keyof typeof MEDIA_EXTENSIONS;

const SUPPORTED_CONTENT_TYPES = Object.keys(MEDIA_EXTENSIONS) as SupportedMediaContentType[];

export class CreateMediaDto {
  @ApiProperty({ enum: ['image', 'video'] })
  @IsEnum({ image: 'image', video: 'video' })
  type!: 'image' | 'video';

  @ApiProperty({ enum: SUPPORTED_CONTENT_TYPES, example: 'image/jpeg' })
  @IsString()
  @IsIn(SUPPORTED_CONTENT_TYPES, { message: 'unsupported media type' })
  contentType!: SupportedMediaContentType;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1024 * 1024 * 100)
  sizeBytes!: number;
}
