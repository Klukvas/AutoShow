import type { ListingAiFact, ListingAiResult } from './listing-ai.types';

/** Column limits from listings (title 255, meta_description 320) plus headroom for the body. */
const LIMITS = { description: 8000, metaTitle: 255, metaDescription: 320 } as const;
const MAX_FACTS = 100;
const MAX_FACT_TEXT = 500;

export class ListingAiResultError extends Error {
  constructor(readonly detail: string) {
    super('ШІ повернув некоректну відповідь. Спробуйте ще раз.');
    this.name = 'ListingAiResultError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ListingAiResultError(`${field} is not a string`);
  const trimmed = value.replace(/\r\n/g, '\n').trim();
  if (!trimmed) throw new ListingAiResultError(`${field} is empty`);
  if (trimmed.length > max) throw new ListingAiResultError(`${field} is longer than ${max}`);
  return trimmed;
}

/** May be empty: the validator then flags the fact as unsupported. */
function factValue(value: unknown, index: number): string {
  if (typeof value !== 'string')
    throw new ListingAiResultError(`facts[${index}].value is not a string`);
  return value.trim().slice(0, MAX_FACT_TEXT);
}

function fact(value: unknown, index: number): ListingAiFact {
  if (!isRecord(value)) throw new ListingAiResultError(`facts[${index}] is not an object`);
  return {
    claim: text(value.claim, `facts[${index}].claim`, MAX_FACT_TEXT),
    sourceField: text(value.sourceField, `facts[${index}].sourceField`, 64),
    value: factValue(value.value, index),
  };
}

/**
 * The provider enforces the schema, but its output is still external data:
 * check shape and sizes before anything is stored.
 */
export function parseListingAiResult(output: unknown): ListingAiResult {
  if (!isRecord(output)) throw new ListingAiResultError('output is not an object');
  if (!Array.isArray(output.facts)) throw new ListingAiResultError('facts is not an array');
  if (output.facts.length > MAX_FACTS) throw new ListingAiResultError('too many facts');
  return {
    description: text(output.description, 'description', LIMITS.description),
    metaTitle: text(output.metaTitle, 'metaTitle', LIMITS.metaTitle),
    metaDescription: text(output.metaDescription, 'metaDescription', LIMITS.metaDescription),
    facts: output.facts.map(fact),
  };
}
