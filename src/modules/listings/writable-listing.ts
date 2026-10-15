import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { Listing } from './entities/listing.entity';

/** Acquire before any media row lock; listing status transitions take this row lock too. */
export async function lockWritableListing(em: EntityManager, id: string): Promise<Listing> {
  const listing = await em.findOne(Listing, {
    where: { id, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!listing) throw new NotFoundException('Listing not found');
  if (listing.status === 'sold') throw new ForbiddenException('Sold listings are read-only');
  return listing;
}
