import { ListingsService } from './listings.service';

describe('ListingsService public detail', () => {
  it('loads only ready media', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'listing-1' }),
    };
    const empty = {} as never;
    const service = new ListingsService(
      { createQueryBuilder: jest.fn(() => qb) } as never, // listings
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
      empty, // audit
      empty, // config
    );

    await service.findPublishedBySlug('car');

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('l.media', 'media', "media.status = 'ready'");
  });
});
