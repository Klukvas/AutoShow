import type { Listing } from '../listings/entities/listing.entity';
import type { ListingMedia } from '../listings/entities/listing-media.entity';
import {
  LISTING_AI_MAX_PHOTOS,
  buildListingAiInput,
  canonicalJson,
  listingAiInputHash,
  selectListingAiPhotos,
} from './listing-ai.input';

const named = (nameUk: string) => ({ nameUk, deletedAt: null });

function listing(overrides: Partial<Record<string, unknown>> = {}): Listing {
  return {
    id: 'listing',
    make: named(' BMW '),
    model: named('X5'),
    generation: ' G05 ',
    modification: '   ',
    year: 2021,
    mileageKm: 45000,
    bodyType: named('Позашляховик'),
    fuelType: named('Дизель'),
    transmission: named('Автомат'),
    driveType: named('Повний'),
    color: named('Чорний'),
    engineVolumeL: '3.0',
    powerHp: 286,
    condition: 'used',
    ownersCount: 1,
    isCrashed: false,
    customsCleared: true,
    locationCity: ' Київ ',
    locationRegion: null,
    options: [
      { option: { category: 'safety', nameUk: 'Камера заднього виду', deletedAt: null } },
      { option: { category: 'comfort', nameUk: 'Підігрів сидінь', deletedAt: null } },
      { option: { category: 'comfort', nameUk: 'Клімат-контроль', deletedAt: null } },
      { option: { category: 'comfort', nameUk: 'Люк', deletedAt: new Date() } },
    ],
    tags: [
      { tag: { nameUk: 'Перевірено', isPublished: true, deletedAt: null } },
      { tag: { nameUk: 'Внутрішня мітка', isPublished: false, deletedAt: null } },
    ],
    vin: 'WBA00000000000000',
    vinVisible: true,
    sellerName: 'Іван',
    sellerPhone: '+380000000000',
    feeType: 'percent',
    feePercent: '3.00',
    commissionAmount: '900.00',
    salePriceAmount: '30000.00',
    priceAmount: '31000.00',
    priceCurrency: 'USD',
    isNegotiable: true,
    title: 'BMW X5 у топовій комплектації',
    description: 'Старий опис',
    metaTitle: 'old',
    ...overrides,
  } as unknown as Listing;
}

function photo(id: string, extra: Partial<Record<string, unknown>> = {}): ListingMedia {
  return {
    id,
    type: 'image',
    status: 'ready',
    deletedAt: null,
    isCover: false,
    position: 0,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    originalS3Key: `orig/${id}.jpg`,
    activeAiVariant: { s3Key: `ai/${id}.png` },
    renditions: [
      { variant: 'thumb', format: 'jpeg', s3Key: `${id}/thumb.jpg`, deletedAt: null },
      { variant: 'gallery', format: 'webp', s3Key: `${id}/gallery.webp`, deletedAt: null },
      { variant: 'gallery', format: 'jpeg', s3Key: `${id}/gallery.jpg`, deletedAt: null },
    ],
    ...extra,
  } as unknown as ListingMedia;
}

describe('buildListingAiInput', () => {
  it('keeps only whitelisted facts: no VIN, seller, fees, commission, price or free text', () => {
    const input = buildListingAiInput(listing());
    const serialized = JSON.stringify(input);
    for (const secret of [
      'WBA00000000000000',
      '+380000000000',
      'Іван',
      '900.00',
      '30000.00',
      '31000.00',
      'топовій',
      'Старий опис',
    ])
      expect(serialized).not.toContain(secret);
    expect(Object.keys(input).sort()).toEqual(
      [
        'bodyType',
        'color',
        'condition',
        'customsCleared',
        'driveType',
        'engineVolumeL',
        'fuelType',
        'generation',
        'isCrashed',
        'isNegotiable',
        'locationCity',
        'locationRegion',
        'make',
        'mileageKm',
        'model',
        'modification',
        'options',
        'ownersCount',
        'powerHp',
        'tags',
        'transmission',
        'year',
      ].sort(),
    );
  });

  it('normalises names, numbers and blank text', () => {
    expect(buildListingAiInput(listing())).toMatchObject({
      make: 'BMW',
      generation: 'G05',
      modification: null,
      engineVolumeL: 3,
      locationCity: 'Київ',
    });
  });

  it('lists live options sorted by category and name, and only published tags', () => {
    const input = buildListingAiInput(listing());
    expect(input.options).toEqual([
      { category: 'comfort', name: 'Клімат-контроль' },
      { category: 'comfort', name: 'Підігрів сидінь' },
      { category: 'safety', name: 'Камера заднього виду' },
    ]);
    expect(input.tags).toEqual(['Перевірено']);
  });

  it('fails loudly when a relation was not loaded instead of inventing a value', () => {
    expect(() => buildListingAiInput(listing({ color: undefined }))).toThrow('"color"');
    expect(() => buildListingAiInput(listing({ options: undefined }))).toThrow('options and tags');
    expect(() => buildListingAiInput(listing({ engineVolumeL: 'abc' }))).toThrow('engine volume');
  });
});

describe('selectListingAiPhotos', () => {
  it('takes ready images, cover first then gallery order, capped at five', () => {
    const media = [
      photo('p3', { position: 3 }),
      photo('p1', { position: 1 }),
      photo('cover', { position: 9, isCover: true }),
      photo('video', { type: 'video' }),
      photo('pending', { status: 'processing' }),
      photo('deleted', { deletedAt: new Date() }),
      photo('p2', { position: 2 }),
      photo('p4', { position: 4 }),
      photo('p5', { position: 5 }),
    ];
    const selected = selectListingAiPhotos(media);
    expect(selected.map((p) => p.mediaId)).toEqual(['cover', 'p1', 'p2', 'p3', 'p4']);
    expect(selected).toHaveLength(LISTING_AI_MAX_PHOTOS);
  });

  it('orders ties by upload time then id, independent of the order rows arrive in', () => {
    const at = (iso: string) => new Date(iso);
    const media = [
      photo('b', { createdAt: at('2026-10-01T10:00:00Z') }),
      photo('c', { createdAt: at('2026-10-01T10:00:01Z') }),
      photo('a', { createdAt: at('2026-10-01T10:00:00Z') }),
      ...['d', 'e', 'f', 'g'].map((id, i) =>
        photo(id, { createdAt: at(`2026-10-01T10:00:0${i + 2}Z`) }),
      ),
    ];
    const expected = ['a', 'b', 'c', 'd', 'e'];
    expect(selectListingAiPhotos(media).map((p) => p.mediaId)).toEqual(expected);
    expect(selectListingAiPhotos([...media].reverse()).map((p) => p.mediaId)).toEqual(expected);
  });

  it('skips a cover that is not ready or deleted and handles no photos', () => {
    const media = [
      photo('cover', { isCover: true, status: 'processing' }),
      photo('gone', { isCover: true, deletedAt: new Date() }),
      photo('next', { position: 1 }),
    ];
    expect(selectListingAiPhotos(media).map((p) => p.mediaId)).toEqual(['next']);
    expect(selectListingAiPhotos([])).toEqual([]);
  });

  it('uses the original upload, preferring a gallery JPEG, never the applied AI variant', () => {
    expect(selectListingAiPhotos([photo('a')])).toEqual([{ mediaId: 'a', s3Key: 'a/gallery.jpg' }]);
    const noJpeg = photo('b', {
      renditions: [
        { variant: 'gallery', format: 'jpeg', s3Key: 'b/gallery.jpg', deletedAt: new Date() },
        { variant: 'gallery', format: 'webp', s3Key: 'b/gallery.webp', deletedAt: null },
      ],
    });
    expect(selectListingAiPhotos([noJpeg])[0].s3Key).toBe('b/gallery.webp');
    expect(selectListingAiPhotos([photo('c', { renditions: [] })])[0].s3Key).toBe('orig/c.jpg');
    expect(JSON.stringify(selectListingAiPhotos([photo('d')]))).not.toContain('ai/');
  });
});

describe('listingAiInputHash', () => {
  const photos = [{ mediaId: 'a', s3Key: 'a/gallery.jpg' }];
  const base = listingAiInputHash(buildListingAiInput(listing()), photos);

  it('is a stable sha256 hex regardless of key order', () => {
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [2, { x: 2, y: 1 }] }, b: 1 }),
    );
  });

  it('rejects values that cannot hash faithfully', () => {
    expect(() => canonicalJson({ at: new Date() })).toThrow('plain objects');
    expect(() => canonicalJson({ n: Number.NaN })).toThrow('non-finite');
    expect(listingAiInputHash(buildListingAiInput(listing()), [])).toBe(
      listingAiInputHash(buildListingAiInput(listing()), []),
    );
  });

  it('sorts options and tags by UTF-16 code unit, not by locale', () => {
    const input = buildListingAiInput(
      listing({
        options: [
          { option: { category: 'comfort', nameUk: 'б', deletedAt: null } },
          { option: { category: 'comfort', nameUk: 'Б', deletedAt: null } },
          { option: { category: 'comfort', nameUk: 'ʼа', deletedAt: null } },
        ],
      }),
    );
    expect(input.options.map((o) => o.name)).toEqual(['ʼа', 'Б', 'б']); // U+02BC < U+0411 < U+0431;
  });

  it('ignores data the model never sees', () => {
    const unseen = listing({
      vin: 'OTHER',
      sellerPhone: '+111',
      priceAmount: '1.00',
      title: 'New title',
      description: 'New text',
      options: [...(listing().options as unknown[])].reverse(),
    });
    expect(listingAiInputHash(buildListingAiInput(unseen), photos)).toBe(base);
  });

  it('changes when a fact or the photo set changes', () => {
    expect(listingAiInputHash(buildListingAiInput(listing({ mileageKm: 46000 })), photos)).not.toBe(
      base,
    );
    expect(
      listingAiInputHash(buildListingAiInput(listing()), [
        ...photos,
        { mediaId: 'b', s3Key: 'b/gallery.jpg' },
      ]),
    ).not.toBe(base);
  });
});
