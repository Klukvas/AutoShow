import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import type { Listing, ListingStatus } from './entities/listing.entity';

interface ListingStub extends Partial<Listing> {
  id: string;
  status: ListingStatus;
  version: number;
}

/** Fields assertPublishable checks — a stub that IS ready to go public. */
const PUBLISHABLE: Partial<Listing> = {
  media: [{ type: 'image', status: 'ready', deletedAt: null }] as Listing['media'],
  sellerType: 'own',
  feeType: 'none',
  vinVisible: false,
  vin: null,
  sellerPhone: null,
  feePercent: null,
  feeFixedAmount: null,
};

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
  const telegram = {
    enqueueAutoPost: jest.fn().mockResolvedValue(undefined),
    enqueueMarkSold: jest.fn().mockResolvedValue(undefined),
  };
  // transition() now wraps the write + audit in a transaction; the em exposes
  // the same query-builder stub so updateWithVersion still hits `execute`.
  const em = { createQueryBuilder: jest.fn(() => qb) };
  const listingsRepo = {
    createQueryBuilder: jest.fn(() => qb),
    manager: { transaction: jest.fn(async (cb: (m: typeof em) => Promise<unknown>) => cb(em)) },
  };
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
    empty, // priceHistory
    empty, // branding
    empty, // fx
    empty, // slug
    audit as never, // audit
    telegram as never, // telegram
    empty, // config
  );
  (svc as unknown as { adminFindById: () => Promise<ListingStub> }).adminFindById = async () =>
    listing;
  return { svc, execute, audit, telegram };
}

describe('ListingsService.transition', () => {
  it('publish: draft -> published', async () => {
    const listing: ListingStub = { id: 'l1', status: 'draft', version: 3, ...PUBLISHABLE };
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
      expect.anything(),
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
    const listing: ListingStub = { id: 'l1', status: 'draft', version: 3, ...PUBLISHABLE };
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

  it('refuses publish without a ready photo', async () => {
    const listing: ListingStub = {
      id: 'l1',
      status: 'draft',
      version: 1,
      ...PUBLISHABLE,
      media: [],
    };
    const { svc } = buildService(listing);
    await expect(
      svc.transition('l1', 'publish', 1, { id: 'u', email: 'e', role: 'admin' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses publish of a client car without a callback phone', async () => {
    const listing: ListingStub = {
      id: 'l1',
      status: 'draft',
      version: 1,
      ...PUBLISHABLE,
      sellerType: 'client',
      sellerPhone: null,
    };
    const { svc } = buildService(listing);
    await expect(
      svc.transition('l1', 'publish', 1, { id: 'u', email: 'e', role: 'admin' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses mark-sold when the percent rate is missing (no silent 0 commission)', async () => {
    const listing: ListingStub = {
      id: 'l1',
      status: 'published',
      version: 1,
      ...PUBLISHABLE,
      feeType: 'percent',
      feePercent: null,
      priceAmount: '10000.00',
    };
    const { svc } = buildService(listing);
    await expect(
      svc.transition('l1', 'mark-sold', 1, { id: 'u', email: 'e', role: 'admin' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('stamps commission from the percent rate at mark-sold', async () => {
    const listing: ListingStub = {
      id: 'l1',
      status: 'published',
      version: 1,
      ...PUBLISHABLE,
      feeType: 'percent',
      feePercent: '10.00',
      priceAmount: '10000.00',
    };
    const { svc } = buildService(listing);
    const result = await svc.transition('l1', 'mark-sold', 1, {
      id: 'u',
      email: 'e',
      role: 'admin',
    });
    expect((result as Listing).status).toBe('sold');
    expect((result as Listing).commissionAmount).toBe('1000.00');
  });
});
