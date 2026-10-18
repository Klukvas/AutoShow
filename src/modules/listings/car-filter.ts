import { Brackets, type WhereExpressionBuilder } from 'typeorm';

/**
 * Multi-make catalog search. Each `car[]` value is one "vehicle set" the
 * buyer is interested in; sets are OR-ed together, and every other catalog
 * filter (price, fuel, …) applies to all of them. `exclude[]` values remove
 * a make, or specific models of a make, from the results.
 *
 * Wire format (kept short so shared URLs stay readable):
 *   car[]=bmw:x5,x6:2018-2022   make + models + year range
 *   car[]=audi                  any Audi
 *   car[]=::2015-               any make, 2015 or newer
 *   exclude[]=bmw:x1            everything except a BMW X1
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

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
const YEAR_RANGE = /^(\d{4})?-(\d{4})?$/;

/** Returns null for anything malformed — the DTO turns that into a 400. */
export function parseCarSet(raw: string): CarSet | null {
  const parts = raw.split(':');
  if (parts.length > 3) return null;
  const [makePart = '', modelsPart = '', yearsPart = ''] = parts;

  const make = makePart || undefined;
  if (make && !SLUG.test(make)) return null;

  const models = parseModels(modelsPart);
  if (!models) return null;
  // A model only means something within its make.
  if (!make && models.length > 0) return null;

  if (!yearsPart) return { make, models };
  const years = YEAR_RANGE.exec(yearsPart);
  if (!years) return null;
  const yearFrom = years[1] ? Number(years[1]) : undefined;
  const yearTo = years[2] ? Number(years[2]) : undefined;
  // A reversed range can only match nothing; reject it instead of a silent 0.
  if (yearFrom != null && yearTo != null && yearFrom > yearTo) return null;
  return { make, models, yearFrom, yearTo };
}

export function parseCarExclusion(raw: string): CarExclusion | null {
  const parts = raw.split(':');
  if (parts.length > 2) return null;
  const [make = '', modelsPart = ''] = parts;
  if (!SLUG.test(make)) return null;
  const models = parseModels(modelsPart);
  return models ? { make, models } : null;
}

/** A set with no make and no years matches every car. */
export function isUnboundedCarSet(set: CarSet): boolean {
  return !set.make && set.yearFrom == null && set.yearTo == null;
}

function parseModels(raw: string): string[] | null {
  if (!raw) return [];
  const models = raw.split(',');
  if (models.length > MAX_MODELS_PER_SET) return null;
  return models.every((m) => SLUG.test(m)) ? [...new Set(models)] : null;
}

/**
 * Narrows a listings query (aliases `l`, `make`, `model`) to the requested
 * vehicle sets and exclusions. Inputs are already DTO-validated, so a value
 * that still fails to parse is a programming error and is skipped.
 */
export function applyCarFilters(
  qb: WhereExpressionBuilder,
  rawSets: readonly string[] = [],
  rawExclusions: readonly string[] = [],
): void {
  const sets = rawSets.map(parseCarSet).filter((s): s is CarSet => s !== null);
  // One "any car" set makes the whole OR trivially true.
  if (sets.length > 0 && !sets.some(isUnboundedCarSet)) {
    qb.andWhere(
      new Brackets((anyOf) => {
        sets.forEach((set, idx) => {
          const { sql, params } = carSetCondition(set, `car${idx}`);
          anyOf.orWhere(sql, params);
        });
      }),
    );
  }

  rawExclusions
    .map(parseCarExclusion)
    .filter((e): e is CarExclusion => e !== null)
    .forEach((exclusion, idx) => {
      const { sql, params } = carSetCondition(exclusion, `ex${idx}`);
      // COALESCE: a listing without a model yields NULL for `model.slug IN …`,
      // and NOT NULL would wrongly drop it from the results.
      qb.andWhere(`NOT COALESCE(${sql}, false)`, params);
    });
}

function carSetCondition(
  set: CarSet,
  prefix: string,
): { sql: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (set.make) {
    conditions.push(`make.slug = :${prefix}Make`);
    params[`${prefix}Make`] = set.make;
  }
  if (set.models.length > 0) {
    conditions.push(`model.slug IN (:...${prefix}Models)`);
    params[`${prefix}Models`] = set.models;
  }
  if (set.yearFrom != null) {
    conditions.push(`l.year >= :${prefix}YearFrom`);
    params[`${prefix}YearFrom`] = set.yearFrom;
  }
  if (set.yearTo != null) {
    conditions.push(`l.year <= :${prefix}YearTo`);
    params[`${prefix}YearTo`] = set.yearTo;
  }
  return { sql: `(${conditions.join(' AND ')})`, params };
}
