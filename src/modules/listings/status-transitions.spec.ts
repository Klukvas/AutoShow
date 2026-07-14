import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import type { Listing, ListingStatus } from './entities/listing.entity';

interface ListingStub extends Partial<Listing> {
  id: string;
  status: ListingStatus;
  version: number;
}

function buildService(listing: ListingStub) {
  const execute = jest.fn(async () => ({ affected: 1 }));
  interface QueryBuilderStub {
    update: jest.Mock<QueryBuilderStub>;
    set: jest.Mock<QueryBuilderStub>;
    where: jest.Mock<QueryBuilderStub>;
    andWhere: jest.Mock<QueryBuilderStub>;
    execute: typeof execute;
  }
  const qb = {} as QueryBuilderStub;
  Object.assign(qb, {
    update: jest.fn().mockReturnThis(),
    set: jest.fn((patch: Partial<ListingStub>): QueryBuilderStub => {
      Object.assign(listing, patch);
      return qb;
    }),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute,
  });
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const listingsRepo = { createQueryBuilder: jest.fn(() => qb) };
  const empty = {} as never;
  const svc = new ListingsService(
    listingsRepo as never, // listings
    empty, // listingOptions
    empty, // makes
    empty, // models
    empty, // bodyTypes
    empty, // fuelTypes
    empty, // transmissions
    empty, // driveTypes
    empty, // colors
    empty, // options
    empty, // media
    empty, // branding
    empty, // fx
    empty, // slug
    audit as never, // audit
    empty, // config
  );
  (svc as unknown as { adminFindById: () => Promise<ListingStub> }).adminFindById = async () =>
    listing;
  return { svc, execute, audit };
}

describe('ListingsService.transition', () => {
  it('publish: draft -> published', async () => {
    const listing: ListingStub = { id: 'l1', status: 'draft', version: 3 };
    const { svc, execute, audit } = buildService(listing);
    const result = await svc.transition('l1', 'publish', 3, {
      id: 'u',
      email: 'e',
      role: 'admin',
    });
    expect((result as Listing).status).toBe('published');
    expect(execute).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'listing.publish' }),
    );
  });

  it('rejects when version does not match (optimistic lock)', async () => {
    const listing: ListingStub = { id: 'l1', status: 'draft', version: 5 };
    const { svc } = buildService(listing);
    await expect(
      svc.transition('l1', 'publish', 2, {
        id: 'u',
        email: 'e',
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses invalid transition (sold -> publish)', async () => {
    const listing: ListingStub = { id: 'l1', status: 'sold', version: 1 };
    const { svc } = buildService(listing);
    await expect(
      svc.transition('l1', 'publish', 1, {
        id: 'u',
        email: 'e',
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reserve: published -> reserved (manual toggle)', async () => {
    const listing: ListingStub = { id: 'l1', status: 'published', version: 2 };
    const { svc } = buildService(listing);
    const result = await svc.transition('l1', 'reserve', 2, {
      id: 'u',
      email: 'e',
      role: 'admin',
    });
    expect((result as Listing).status).toBe('reserved');
  });

  it('rejects when the atomic versioned update loses a race', async () => {
    const listing: ListingStub = { id: 'l1', status: 'draft', version: 3 };
    const { svc, execute } = buildService(listing);
    execute.mockResolvedValueOnce({ affected: 0 });
    await expect(
      svc.transition('l1', 'publish', 3, {
        id: 'u',
        email: 'e',
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
