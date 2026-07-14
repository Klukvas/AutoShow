import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class TransitionStatusDto {
  @IsInt()
  @Min(1)
  version!: number;

  /**
   * mark-sold only: the final negotiated price (listing currency). Defaults
   * to the asking price; the commission is computed from it and stamped on
   * the listing. Ignored by every other transition.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  salePriceAmount?: number;
}
