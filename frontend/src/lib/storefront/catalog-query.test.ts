import { describe, expect, it } from 'vitest';
import { buildCatalogQuery, catalogHref, selectedSingleMake } from './catalog-query';

describe('buildCatalogQuery', () => {
  it('defaults to the newest first page of 24', () => {
    expect(buildCatalogQuery({})).toEqual({
      q: undefined,
      bodyType: undefined,
      fuelType: undefined,
      transmission: undefined,
      driveType: undefined,
      condition: undefined,
      city: undefined,
      priceMin: undefined,
      priceMax: undefined,
      mileageMax: undefined,
      options: undefined,
      tags: undefined,
      sort: 'newest',
      cursor: undefined,
      limit: 24,
    });
  });

  it('takes the first value of repeated scalar params and keeps the cursor', () => {
    const query = buildCatalogQuery({
      q: ['bmw', 'audi'],
      sort: 'price_asc',
      bodyType: 'suv',
      condition: 'used',
      cursor: 'c2',
    });
    expect(query).toMatchObject({
      q: 'bmw',
      sort: 'price_asc',
      bodyType: 'suv',
      condition: 'used',
      cursor: 'c2',
    });
  });

  it('parses numbers and drops empty or non-numeric ones', () => {
    const query = buildCatalogQuery({ priceMin: '1000', priceMax: '', mileageMax: 'abc' });
    expect(query.priceMin).toBe(1000);
    expect(query.priceMax).toBeUndefined();
    expect(query.mileageMax).toBeUndefined();
  });

  it('prefers the bracketed list form for options and tags', () => {
    const query = buildCatalogQuery({
      'options[]': ['carplay', 'heated-seats'],
      options: 'ignored',
      tags: 'top-deal',
    });
    expect(query.options).toEqual(['carplay', 'heated-seats']);
    expect(query.tags).toEqual(['top-deal']);
  });

  it('reads vehicle sets and legacy make/year links', () => {
    expect(buildCatalogQuery({ 'car[]': ['bmw:x5:2018-2022', 'audi'] }).car).toEqual([
      'bmw:x5:2018-2022',
      'audi',
    ]);
    expect(buildCatalogQuery({ make: 'bmw', yearMin: '2019' }).car).toEqual(['bmw::2019-']);
  });
});

describe('selectedSingleMake', () => {
  it('returns the make only when one bare make is the whole selection', () => {
    expect(selectedSingleMake({ car: ['bmw'] })).toBe('bmw');
    expect(selectedSingleMake({ car: ['bmw:x5'] })).toBeUndefined();
    expect(selectedSingleMake({ car: ['bmw', 'audi'] })).toBeUndefined();
    expect(selectedSingleMake({})).toBeUndefined();
  });
});

describe('catalogHref', () => {
  it('rebuilds the current URL, repeated keys included', () => {
    expect(catalogHref({})).toBe('/cars');
    expect(catalogHref({ 'car[]': ['bmw', 'audi'], q: 'x', cursor: undefined })).toBe(
      '/cars?car%5B%5D=bmw&car%5B%5D=audi&q=x',
    );
  });
});
