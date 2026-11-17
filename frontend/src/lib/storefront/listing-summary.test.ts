import { describe, expect, it } from 'vitest';
import type { PublicListing } from '@/lib/api/types';
import {
  AVAILABILITY_LABEL_KEYS,
  acceptsLeads,
  breadcrumbsJsonLd,
  listingAvailability,
  listingPrice,
  listingSubLine,
  ownerPhone,
} from './listing-summary';

// The formatters use typographic (narrow no-break) spaces on purpose; these
// tests assert the digits/grouping/glyph, not the exact whitespace codepoint.
const norm = (text: string | null) => text?.replace(/\s/g, ' ') ?? null;

const price = (overrides: Partial<PublicListing['price']> = {}): PublicListing['price'] => ({
  amount: '38500.00',
  currency: 'USD',
  normalized: '1617000.00',
  isNegotiable: false,
  priceDrop: null,
  ...overrides,
});

describe('listingPrice', () => {
  it('shows the price in the listing currency and no note when there is nothing to add', () => {
    const result = listingPrice(price(), 'USD', 'торг');
    expect({ price: norm(result.price), priceNote: result.priceNote }).toEqual({
      price: '$ 38 500',
      priceNote: null,
    });
  });

  it('adds the base-currency approximation only when the currencies differ', () => {
    expect(norm(listingPrice(price(), 'UAH', 'торг').priceNote)).toBe('≈ ₴ 1 617 000');
  });

  it('appends the negotiable label after the approximation', () => {
    const negotiable = price({ isNegotiable: true });
    expect(norm(listingPrice(negotiable, 'UAH', 'торг').priceNote)).toBe('≈ ₴ 1 617 000 · торг');
    expect(listingPrice(negotiable, 'USD', 'торг').priceNote).toBe('торг');
  });

  it('skips the approximation when the site has no base currency', () => {
    expect(listingPrice(price({ isNegotiable: true }), undefined, 'торг').priceNote).toBe('торг');
  });
});

describe('listing availability', () => {
  it.each([
    ['published', 'available', 'statusAvailable', true],
    ['reserved', 'reserved', 'statusReserved', true],
    ['sold', 'sold', 'statusSold', false],
  ] as const)('%s is shown as %s (%s), leads accepted: %s', (status, shown, labelKey, leads) => {
    const availability = listingAvailability(status);
    expect(availability).toBe(shown);
    expect(AVAILABILITY_LABEL_KEYS[availability]).toBe(labelKey);
    expect(acceptsLeads(availability)).toBe(leads);
  });
});

describe('listingSubLine', () => {
  const location = { city: 'Київ', region: null };

  it('joins year, body type and city', () => {
    const bodyType = { id: 'sedan', slug: 'sedan', nameUk: 'Седан', nameEn: null };
    expect(listingSubLine({ year: 2019, bodyType, location })).toBe('2019 · Седан · Київ');
  });

  it('skips a missing body type instead of leaving an empty slot', () => {
    expect(listingSubLine({ year: 2019, bodyType: null, location })).toBe('2019 · Київ');
  });
});

describe('ownerPhone', () => {
  it("overrides the showroom phone only for a client's car", () => {
    expect(ownerPhone({ type: 'client', name: 'Олег', phone: '+380501112233' })).toBe(
      '+380501112233',
    );
    expect(ownerPhone({ type: 'own', name: null, phone: '+380501112233' })).toBeUndefined();
  });
});

describe('breadcrumbsJsonLd', () => {
  it('builds the Головна → Каталог → car trail on the origin of the canonical URL', () => {
    const jsonLd = breadcrumbsJsonLd(
      { title: 'BMW 5 Series', canonical: 'https://dealer.example/cars/bmw-5-series-2016' },
      { home: 'Головна', catalog: 'Каталог' },
    );
    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://dealer.example' },
        { '@type': 'ListItem', position: 2, name: 'Каталог', item: 'https://dealer.example/cars' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'BMW 5 Series',
          item: 'https://dealer.example/cars/bmw-5-series-2016',
        },
      ],
    });
  });
});
