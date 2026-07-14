import { PartialType } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsInt()
  @Min(1)
  version!: number;
}
