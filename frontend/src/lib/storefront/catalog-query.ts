import type { ListingsQuery } from '@/lib/api/types';
import { carFiltersQuery, readCarFilters } from '@/lib/car-filter';

export type CatalogSearchParams = Readonly<Record<string, string | string[] | undefined>>;

const CATALOG_PAGE_SIZE = 24;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Turns the catalogue URL into the listings API query. */
export function buildCatalogQuery(search: CatalogSearchParams): ListingsQuery {
  const get = (key: string) => firstValue(search[key]);
  const getAll = (key: string) => {
    const value = search[key];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };
  const getMany = (key: string) => {
    const values = getAll(`${key}[]`);
    const all = values.length > 0 ? values : getAll(key);
    return all.length > 0 ? all : undefined;
  };
  const num = (key: string) => {
    const v = get(key);
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Vehicle sets carry make, models and years — including old ?make=&yearMin=
  // links, which read as a single set.
  const cars = readCarFilters(getAll);

  return {
    q: get('q'),
    ...carFiltersQuery(cars),
    bodyType: get('bodyType'),
    fuelType: get('fuelType'),
    transmission: get('transmission'),
    driveType: get('driveType'),
    condition: get('condition') as ListingsQuery['condition'],
    city: get('city'),
    priceMin: num('priceMin'),
    priceMax: num('priceMax'),
    mileageMax: num('mileageMax'),
    options: getMany('options'),
    tags: getMany('tags'),
    sort: (get('sort') as ListingsQuery['sort']) ?? 'newest',
    cursor: get('cursor'),
    limit: CATALOG_PAGE_SIZE,
  };
}

/** The brand strip highlights a make only when it is the whole selection. */
export function selectedSingleMake(query: ListingsQuery): string | undefined {
  return query.car?.length === 1 && !query.car[0].includes(':') ? query.car[0] : undefined;
}

/** Retry target: the current filters/cursor stack, so a reload is a real retry. */
export function catalogHref(search: CatalogSearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  const qs = params.toString();
  return qs ? `/cars?${qs}` : '/cars';
}
