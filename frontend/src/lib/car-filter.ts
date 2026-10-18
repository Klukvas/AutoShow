/**
 * Multi-make catalog search, client side. Mirrors the backend wire format
 * (src/modules/listings/car-filter.ts):
 *   car[]=bmw:x5,x6:2018-2022   one "vehicle set"; sets are OR-ed
 *   exclude[]=bmw:x1            a make, or models of a make, to leave out
 * Older links (?make=bmw&model=x5&yearMin=2018) still open: they read as a
 * single set and are rewritten to car[] on the next filter change.
 */

export const MAX_CAR_SETS = 5;
export const MAX_EXCLUSIONS = 5;
export const MAX_MODELS_PER_SET = 10;

export interface CarSet {
  make?: string;
  models: string[];
  yearFrom?: number;
  yearTo?: number;
}

export interface CarExclusion {
  make: string;
  models: string[];
}

export interface CarFilters {
  sets: CarSet[];
  exclusions: CarExclusion[];
}

/** URL keys replaced by car[] — cleared whenever sets are written. */
export const LEGACY_CAR_KEYS = ['make', 'model', 'yearMin', 'yearMax'] as const;

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
const YEAR_RANGE = /^(\d{4})?-(\d{4})?$/;
const YEAR = /^\d{4}$/;

export const EMPTY_CAR_SET: CarSet = { models: [] };

export function isEmptyCarSet(set: CarSet): boolean {
  return !set.make && set.yearFrom == null && set.yearTo == null;
}

export function encodeCarSet(set: CarSet): string {
  // A reversed range ("2022–2018") is what the buyer meant the other way round.
  const [from, to] =
    set.yearFrom != null && set.yearTo != null && set.yearFrom > set.yearTo
      ? [set.yearTo, set.yearFrom]
      : [set.yearFrom, set.yearTo];
  const years = from == null && to == null ? '' : `${from ?? ''}-${to ?? ''}`;
  const models = set.make ? set.models.join(',') : '';
  return [set.make ?? '', models, years].join(':').replace(/:+$/, '');
}

export function encodeExclusion(exclusion: CarExclusion): string {
  return exclusion.models.length > 0
    ? `${exclusion.make}:${exclusion.models.join(',')}`
    : exclusion.make;
}

/** Lenient: a hand-edited URL loses its broken pieces instead of erroring. */
export function decodeCarSet(raw: string): CarSet | null {
  const [makePart = '', modelsPart = '', yearsPart = ''] = raw.split(':');
  const make = SLUG.test(makePart) ? makePart : undefined;
  const models = make ? parseModels(modelsPart) : [];
  const years = YEAR_RANGE.exec(yearsPart);
  const set: CarSet = {
    make,
    models,
    yearFrom: years?.[1] ? Number(years[1]) : undefined,
    yearTo: years?.[2] ? Number(years[2]) : undefined,
  };
  return isEmptyCarSet(set) ? null : set;
}

export function decodeExclusion(raw: string): CarExclusion | null {
  const [make = '', modelsPart = ''] = raw.split(':');
  return SLUG.test(make) ? { make, models: parseModels(modelsPart) } : null;
}

/**
 * Reads the vehicle sets and exclusions from search params. `getAll` returns
 * every value for a key (URLSearchParams.getAll or an RSC searchParams shim).
 */
export function readCarFilters(getAll: (key: string) => string[]): CarFilters {
  const exclusions = dedupe(
    [...getAll('exclude[]'), ...getAll('exclude')]
      .map(decodeExclusion)
      .filter((e): e is CarExclusion => e !== null)
      .slice(0, MAX_EXCLUSIONS),
    encodeExclusion,
  );

  const rawSets = [...getAll('car[]'), ...getAll('car')];
  if (rawSets.length > 0) {
    const sets = rawSets
      .map(decodeCarSet)
      .filter((s): s is CarSet => s !== null)
      .slice(0, MAX_CAR_SETS);
    return { sets: dedupe(sets, encodeCarSet), exclusions };
  }

  const legacy = legacySet(getAll);
  return { sets: legacy ? [legacy] : [], exclusions };
}

/** Patch for the catalog URL updater: writes car[]/exclude[] and drops legacy keys. */
export function carFiltersPatch(filters: CarFilters): Record<string, string[] | undefined> {
  const legacyCleared = Object.fromEntries(LEGACY_CAR_KEYS.map((key) => [key, undefined]));
  return {
    ...legacyCleared,
    car: unique(filters.sets.filter((s) => !isEmptyCarSet(s)).map(encodeCarSet)),
    exclude: unique(filters.exclusions.map(encodeExclusion)),
  };
}

/** API query fields for the listings endpoint. */
export function carFiltersQuery(filters: CarFilters): { car?: string[]; exclude?: string[] } {
  const car = filters.sets.map(encodeCarSet);
  const exclude = filters.exclusions.map(encodeExclusion);
  return {
    car: car.length > 0 ? car : undefined,
    exclude: exclude.length > 0 ? exclude : undefined,
  };
}

function legacySet(getAll: (key: string) => string[]): CarSet | null {
  const first = (key: string) => getAll(key)[0] ?? '';
  const make = SLUG.test(first('make')) ? first('make') : undefined;
  const model = make && SLUG.test(first('model')) ? first('model') : undefined;
  const year = (key: string) => (YEAR.test(first(key)) ? Number(first(key)) : undefined);
  const set: CarSet = {
    make,
    models: model ? [model] : [],
    yearFrom: year('yearMin'),
    yearTo: year('yearMax'),
  };
  return isEmptyCarSet(set) ? null : set;
}

function parseModels(raw: string): string[] {
  if (!raw) return [];
  const models = raw.split(',').filter((m) => SLUG.test(m));
  return [...new Set(models)].slice(0, MAX_MODELS_PER_SET);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
