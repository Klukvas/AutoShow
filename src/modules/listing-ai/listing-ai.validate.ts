import type { ListingAiInput } from './listing-ai.input';
import {
  LISTING_AI_LENGTHS,
  LISTING_AI_SOURCE_FIELDS,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  type ListingAiBrandVoice,
} from './listing-ai.prompts';
import { normalizeText, parseNumber } from './listing-ai.text';
import { checkDisclosures } from './listing-ai.disclosures';
import { checkBargain, checkForbidden, checkNumbers, type Texts } from './listing-ai.text-checks';
import type {
  ListingAiFact,
  ListingAiField,
  ListingAiFlag,
  ListingAiPreset,
  ListingAiResult,
  ListingAiValidation,
} from './listing-ai.types';

/**
 * Server-side check of a draft against the listing it was made from. Flags
 * are not proof of an error — the owner confirms or fixes each one — but a
 * draft with an unresolved flag must not be accepted silently.
 */

const SOURCE_FIELDS: ReadonlySet<string> = new Set(LISTING_AI_SOURCE_FIELDS);

function factMatches(fact: ListingAiFact, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    const names = expected.map((item) =>
      normalizeText(typeof item === 'string' ? item : String((item as { name: string }).name)),
    );
    return names.includes(normalizeText(fact.value));
  }
  if (typeof expected === 'number') {
    const cited = parseNumber(fact.value);
    return cited !== null && Math.abs(cited - expected) < 0.05;
  }
  if (typeof expected === 'boolean') return normalizeText(fact.value) === String(expected);
  if (typeof expected === 'string') return normalizeText(fact.value) === normalizeText(expected);
  return false;
}

function checkFacts(result: ListingAiResult, input: ListingAiInput): ListingAiFlag[] {
  return result.facts.flatMap((fact): ListingAiFlag[] => {
    const base = { claim: fact.claim, sourceField: fact.sourceField, field: null };
    if (!SOURCE_FIELDS.has(fact.sourceField)) return [{ ...base, reason: 'unknown_field' }];
    const expected = input[fact.sourceField as keyof ListingAiInput];
    // A fact about a field the listing leaves empty was invented.
    if (expected === null) return [{ ...base, reason: 'unsupported' }];
    return factMatches(fact, expected) ? [] : [{ ...base, reason: 'mismatch' }];
  });
}

function checkLengths(result: ListingAiResult, preset: ListingAiPreset): ListingAiFlag[] {
  // Some slack over the preset: the model counts loosely and a bit longer is harmless.
  const limits: ReadonlyArray<[ListingAiField, number]> = [
    ['description', Math.round(LISTING_AI_LENGTHS[preset].max * 1.3)],
    ['metaTitle', META_TITLE_MAX],
    ['metaDescription', META_DESCRIPTION_MAX],
  ];
  return limits
    .filter(([field, max]) => result[field].length > max)
    .map(
      ([field, max]): ListingAiFlag => ({
        reason: 'too_long',
        claim: `${result[field].length} символів (ліміт ${max})`,
        sourceField: null,
        field,
      }),
    );
}

/** Same flag twice (e.g. a year in both meta fields) is reported once per field. */
function unique(flags: readonly ListingAiFlag[]): ListingAiFlag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = JSON.stringify([
      flag.reason,
      normalizeText(flag.claim),
      flag.sourceField,
      flag.field,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateListingAiResult(
  result: ListingAiResult,
  input: ListingAiInput,
  preset: ListingAiPreset,
  voice?: ListingAiBrandVoice,
): ListingAiValidation {
  const texts: Texts = [
    { field: 'description', text: result.description },
    { field: 'metaTitle', text: result.metaTitle },
    { field: 'metaDescription', text: result.metaDescription },
  ];
  return {
    flags: unique([
      ...checkFacts(result, input),
      ...checkNumbers(texts, input),
      ...checkForbidden(texts, voice),
      ...checkDisclosures(texts, input),
      ...checkBargain(texts, input),
      ...checkLengths(result, preset),
    ]),
  };
}
