import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsUUID } from 'class-validator';

export type BulkListingAction = 'publish' | 'archive' | 'delete';

export class BulkListingsDto {
  @ApiProperty({ type: [String], description: 'Listing ids to act on' })
  @IsArray()
  @ArrayNotEmpty()
  // Cap the batch so one request can't lock the table for minutes.
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiProperty({ enum: ['publish', 'archive', 'delete'] })
  @IsIn(['publish', 'archive', 'delete'])
  action!: BulkListingAction;
}
