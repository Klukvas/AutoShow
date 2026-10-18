import { Brackets } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { applyCarFilters, parseCarExclusion, parseCarSet } from './car-filter';
import { ListListingsQuery } from './dto/list-listings.query';

describe('parseCarSet', () => {
  it.each([
    ['bmw', { make: 'bmw', models: [] }],
    ['bmw:x5,x6', { make: 'bmw', models: ['x5', 'x6'] }],
    ['bmw:x5,x6:2018-2022', { make: 'bmw', models: ['x5', 'x6'], yearFrom: 2018, yearTo: 2022 }],
    ['bmw::2018-', { make: 'bmw', models: [], yearFrom: 2018, yearTo: undefined }],
    ['::-2010', { make: undefined, models: [], yearFrom: undefined, yearTo: 2010 }],
    ['bmw:x5,x5', { make: 'bmw', models: ['x5'] }],
  ])('parses %s', (raw, expected) => {
    expect(parseCarSet(raw)).toEqual(expected);
  });

  it.each([
    ':x5', // model without make
    'BMW', // slugs are lowercase
    'bmw:x5:2018', // year range needs a dash
    'bmw:x5:18-22',
    'bmw:x5:2018-2022:extra',
    "bmw'; drop table",
    'bmw:a,b,c,d,e,f,g,h,i,j,k', // > 10 models
    'bmw:x5,',
    'bmw::2022-2018', // reversed range
  ])('rejects %s', (raw) => {
    expect(parseCarSet(raw)).toBeNull();
  });
});

describe('parseCarExclusion', () => {
  it('parses a make and optional models', () => {
    expect(parseCarExclusion('lada')).toEqual({ make: 'lada', models: [] });
    expect(parseCarExclusion('bmw:x1')).toEqual({ make: 'bmw', models: ['x1'] });
  });

  it('requires a make and allows no year range', () => {
    expect(parseCarExclusion(':x1')).toBeNull();
    expect(parseCarExclusion('bmw:x1:2018-')).toBeNull();
  });
});

describe('applyCarFilters', () => {
  /** Records the SQL + params a query builder receives, including nested Brackets. */
  function recorder() {
    const calls: Array<{ sql: string; params?: Record<string, unknown> }> = [];
    const qb = {
      andWhere: (where: string | Brackets, params?: Record<string, unknown>) => {
        if (where instanceof Brackets) {
          const inner: string[] = [];
          const nested = {
            orWhere: (sql: string, p: Record<string, unknown>) => {
              inner.push(sql);
              calls.push({ sql: `OR ${sql}`, params: p });
              return nested;
            },
          };
          where.whereFactory(nested as never);
          calls.push({ sql: `ANY[${inner.join(' | ')}]` });
        } else {
          calls.push({ sql: where, params });
        }
        return qb;
      },
    };
    return { qb, calls };
  }

  it('ORs vehicle sets, each scoped to its make, models and years', () => {
    const { qb, calls } = recorder();
    applyCarFilters(qb as never, ['bmw:x5,x6:2018-2022', 'audi']);
    expect(calls).toEqual([
      {
        sql: 'OR (make.slug = :car0Make AND model.slug IN (:...car0Models) AND l.year >= :car0YearFrom AND l.year <= :car0YearTo)',
        params: { car0Make: 'bmw', car0Models: ['x5', 'x6'], car0YearFrom: 2018, car0YearTo: 2022 },
      },
      { sql: 'OR (make.slug = :car1Make)', params: { car1Make: 'audi' } },
      {
        sql: 'ANY[(make.slug = :car0Make AND model.slug IN (:...car0Models) AND l.year >= :car0YearFrom AND l.year <= :car0YearTo) | (make.slug = :car1Make)]',
      },
    ]);
  });

  it('adds no set constraint when one set matches any car', () => {
    const { qb, calls } = recorder();
    applyCarFilters(qb as never, ['bmw', '::']);
    expect(calls).toEqual([]);
  });

  it('keeps model-less listings when excluding specific models', () => {
    const { qb, calls } = recorder();
    applyCarFilters(qb as never, [], ['bmw:x1', 'lada']);
    expect(calls).toEqual([
      {
        sql: 'NOT COALESCE((make.slug = :ex0Make AND model.slug IN (:...ex0Models)), false)',
        params: { ex0Make: 'bmw', ex0Models: ['x1'] },
      },
      { sql: 'NOT COALESCE((make.slug = :ex1Make), false)', params: { ex1Make: 'lada' } },
    ]);
  });
});

describe('ListListingsQuery car/exclude validation', () => {
  const errorsFor = async (plain: Record<string, unknown>) =>
    (await validate(plainToInstance(ListListingsQuery, plain))).map((e) => e.property);

  it('accepts a single value and wraps it in an array', async () => {
    const query = plainToInstance(ListListingsQuery, { car: 'bmw:x5', exclude: 'lada' });
    expect(query.car).toEqual(['bmw:x5']);
    expect(await validate(query)).toEqual([]);
  });

  it('rejects malformed values and too many sets', async () => {
    expect(await errorsFor({ car: [':x5'] })).toEqual(['car']);
    expect(await errorsFor({ exclude: ['bmw:x5:2018-'] })).toEqual(['exclude']);
    expect(await errorsFor({ car: ['a', 'b', 'c', 'd', 'e', 'f'] })).toEqual(['car']);
  });
});
