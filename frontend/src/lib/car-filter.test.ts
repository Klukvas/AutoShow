import { describe, expect, it } from 'vitest';
import {
  carFiltersPatch,
  decodeCarSet,
  encodeCarSet,
  readCarFilters,
  type CarSet,
} from './car-filter';

const params = (query: string) => {
  const search = new URLSearchParams(query);
  return (key: string) => search.getAll(key);
};

describe('car set encoding', () => {
  it.each<[CarSet, string]>([
    [{ make: 'bmw', models: [] }, 'bmw'],
    [{ make: 'bmw', models: ['x5', 'x6'] }, 'bmw:x5,x6'],
    [{ make: 'bmw', models: ['x5'], yearFrom: 2018, yearTo: 2022 }, 'bmw:x5:2018-2022'],
    [{ make: 'bmw', models: [], yearFrom: 2018 }, 'bmw::2018-'],
    [{ models: [], yearTo: 2010 }, '::-2010'],
  ])('round-trips %j as %s', (set, encoded) => {
    expect(encodeCarSet(set)).toBe(encoded);
    expect(decodeCarSet(encoded)).toEqual({ yearFrom: undefined, yearTo: undefined, ...set });
  });

  it('writes a reversed year range in order', () => {
    expect(encodeCarSet({ make: 'bmw', models: [], yearFrom: 2022, yearTo: 2018 })).toBe(
      'bmw::2018-2022',
    );
  });

  it('drops broken pieces of a hand-edited value', () => {
    expect(decodeCarSet('bmw:X5,x6:20-22')).toEqual({
      make: 'bmw',
      models: ['x6'],
      yearFrom: undefined,
      yearTo: undefined,
    });
    expect(decodeCarSet(':x5')).toBeNull();
  });
});

describe('readCarFilters', () => {
  it('reads sets and exclusions, deduplicated and capped', () => {
    const filters = readCarFilters(
      params('car[]=bmw:x5&car[]=bmw:x5&car[]=audi&exclude[]=bmw:x1&exclude[]=lada'),
    );
    expect(filters.sets.map(encodeCarSet)).toEqual(['bmw:x5', 'audi']);
    expect(filters.exclusions).toEqual([
      { make: 'bmw', models: ['x1'] },
      { make: 'lada', models: [] },
    ]);
    const many = readCarFilters(params('car[]=a&car[]=b&car[]=c&car[]=d&car[]=e&car[]=f'));
    expect(many.sets).toHaveLength(5);
  });

  it('opens old make/model/year links as one set', () => {
    expect(readCarFilters(params('make=bmw&model=x5&yearMin=2018')).sets).toEqual([
      { make: 'bmw', models: ['x5'], yearFrom: 2018, yearTo: undefined },
    ]);
    // A year-only collection link still filters by year.
    expect(readCarFilters(params('yearMax=2015')).sets.map(encodeCarSet)).toEqual(['::-2015']);
    // An orphaned model is ignored, as before.
    expect(readCarFilters(params('model=x5')).sets).toEqual([]);
  });

  it('prefers car[] over legacy keys', () => {
    expect(readCarFilters(params('car[]=audi&make=bmw')).sets.map(encodeCarSet)).toEqual(['audi']);
  });
});

describe('carFiltersPatch', () => {
  it('never writes the same set twice', () => {
    const patch = carFiltersPatch({
      sets: [
        { make: 'audi', models: [] },
        { make: 'audi', models: [] },
      ],
      exclusions: [],
    });
    expect(patch.car).toEqual(['audi']);
  });

  it('writes non-empty sets and clears legacy keys', () => {
    expect(
      carFiltersPatch({
        sets: [{ make: 'bmw', models: [] }, { models: [] }],
        exclusions: [{ make: 'lada', models: [] }],
      }),
    ).toEqual({
      make: undefined,
      model: undefined,
      yearMin: undefined,
      yearMax: undefined,
      car: ['bmw'],
      exclude: ['lada'],
    });
  });
});
