import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { ListingStatus } from '../entities/listing.entity';
import { ListListingsQuery } from './list-listings.query';

const STATUSES: ListingStatus[] = ['draft', 'published', 'reserved', 'sold', 'archived'];

/**
 * Admin list accepts everything the public query does, plus a lifecycle
 * status filter (the public endpoint only ever serves `published`).
 */
export class AdminListListingsQuery extends ListListingsQuery {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: ListingStatus;
}
