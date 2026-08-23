import { ListingsMapper } from './listings.mapper';
import type { Listing } from './entities/listing.entity';
import type { ListingTag } from './entities/listing-tag.entity';

/**
 * A minimal published listing with only the fields the public mapper reads.
 * `tags` is overridden per test — everything else is a stable, valid baseline.
 */
function listingWith(tags: ListingTag[]): Listing {
  return {
    id: 'l1',
    slug: 'bmw-5-series-2021',
    title: 'BMW 5 Series 2021',
    description: 'clean',
    status: 'published',
    makeId: 'mk1',
    make: { id: 'mk1', slug: 'bmw', nameUk: 'BMW', nameEn: 'BMW' },
    modelId: 'md1',
    model: { id: 'md1', slug: '5-series', nameUk: '5 Series', nameEn: null },
    generation: null,
    modification: null,
    year: 2021,
    mileageKm: 42000,
    vin: null,
    vinVisible: false,
    bodyType: undefined,
    fuelType: undefined,
    transmission: undefined,
    driveType: undefined,
    color: undefined,
    engineVolumeL: '2.0',
    powerHp: 248,
    condition: 'used',
    ownersCount: 1,
    isCrashed: false,
    customsCleared: true,
    priceAmount: '38500.00',
    priceCurrency: 'USD',
    priceNormalized: '38500.00',
    previousPriceNormalized: null,
    priceChangedAt: null,
    isNegotiable: true,
    sellerType: 'own',
    sellerName: null,
    sellerPhone: null,
    locationCity: 'Kyiv',
    locationRegion: null,
    metaTitle: null,
    metaDescription: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    viewsCount: 0,
    media: [],
    options: [],
    tags,
  } as unknown as Listing;
}

function tagLink(tag: { slug: string; nameUk: string } | undefined): ListingTag {
  return { listingId: 'l1', tagId: 't', tag } as unknown as ListingTag;
}

describe('ListingsMapper tags', () => {
  const mapper = new ListingsMapper(
    { publicUrlFor: (key: string) => `https://cdn/${key}` } as never,
    { PUBLIC_SITE_URL: 'https://shop.example' } as never,
  );

  it('exposes attached tags as slug + nameUk, in order', () => {
    const listing = listingWith([
      tagLink({ slug: 'obmin', nameUk: 'Обмін' }),
      tagLink({ slug: 'urgent', nameUk: 'Терміновий продаж' }),
    ]);

    expect(mapper.public(listing).tags).toEqual([
      { slug: 'obmin', nameUk: 'Обмін' },
      { slug: 'urgent', nameUk: 'Терміновий продаж' },
    ]);
  });

  it('drops join rows whose tag was filtered out (unpublished/deleted)', () => {
    // The public query left-joins only published, live tags, so an attached but
    // hidden tag arrives as a join row with no `tag` — it must not render blank.
    const listing = listingWith([tagLink({ slug: 'obmin', nameUk: 'Обмін' }), tagLink(undefined)]);

    expect(mapper.public(listing).tags).toEqual([{ slug: 'obmin', nameUk: 'Обмін' }]);
  });

  it('returns an empty array when there are no tags', () => {
    expect(mapper.public(listingWith([])).tags).toEqual([]);
  });
});
