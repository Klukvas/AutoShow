import type { ListingAiInput } from './listing-ai.input';
import type { ListingAiBrandVoice } from './listing-ai.prompts';
import {
  NOT_AFTER_WORD,
  NOT_BEFORE_WORD,
  escapeRegExp,
  normalizeText,
  parseGrouped,
  parseNumber,
} from './listing-ai.text';
import type { ListingAiField, ListingAiFlag } from './listing-ai.types';

/**
 * Checks on the generated prose itself, independent of the facts list the
 * model returned: numbers it did not declare, words it must not use, and
 * honesty disclosures it must make (and must not contradict).
 */

export type Texts = ReadonlyArray<{ field: ListingAiField; text: string }>;

type NumericField = {
  [K in keyof ListingAiInput]: ListingAiInput[K] extends number ? K : never;
}[keyof ListingAiInput];

type NumberClaim = {
  sourceField: NumericField;
  pattern: RegExp;
  read: (match: RegExpMatchArray) => number | null;
  /** Relative tolerance: texts round mileage ("45 тис. км"). */
  tolerance: number;
};

// Fuel consumption ("6 л на 100 км", "6,5 л/100 км") is neither engine nor mileage.
const NOT_CONSUMPTION_AFTER = '(?!\\s*(?:\\/|на)\\s*100)';
const NOT_CONSUMPTION_BEFORE = '(?<!(?:\\/|на)\\s*)';

const NUMBER_CLAIMS: readonly NumberClaim[] = [
  {
    sourceField: 'mileageKm',
    pattern: new RegExp(
      `${NOT_CONSUMPTION_BEFORE}(?<![\\d.,])(\\d{1,3}(?:[\\s\\u00a0\\u202f.]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(k|тис\\.?|тисяч[аі]?)?\\s*км${NOT_BEFORE_WORD}(?!\\s*(?:(?:\\/|за|на|в)\\s*год|\\/\\s*[чг](?![\\p{L}])))`,
      'giu',
    ),
    read: (m) => {
      const value = m[2] ? parseNumber(m[1]) : parseGrouped(m[1]);
      return value === null ? null : m[2] ? value * 1000 : value;
    },
    tolerance: 0.02,
  },
  {
    sourceField: 'powerHp',
    pattern:
      /(?<![\d.,])(\d{2,4})\s*(к\.?\s?с\.?|кс(?![\p{L}\d])|л\.\s?с\.?|кінських сил|hp(?![\p{L}\d]))/giu,
    read: (m) => parseNumber(m[1]),
    tolerance: 0,
  },
  {
    // One leading digit only, so a 650 l boot or a 100 l tank is not read as an engine.
    sourceField: 'engineVolumeL',
    pattern: new RegExp(
      `(?<![\\d.,])(\\d(?:[.,]\\d)?)\\s*(л${NOT_BEFORE_WORD}|л\\.|літр)${NOT_CONSUMPTION_AFTER}`,
      'giu',
    ),
    read: (m) => parseNumber(m[1]),
    tolerance: 0.02,
  },
  {
    sourceField: 'year',
    pattern:
      /(?<![\d.,])((?:19|20)\d{2})(?!\d|[.,]\d|\s*(k|тис|км|к\.?\s?с|hp|кг|квт|л(?![\p{L}\d])))/giu,
    read: (m) => parseNumber(m[1]),
    tolerance: 0,
  },
  {
    sourceField: 'ownersCount',
    pattern: /(?<![\d.,])(\d+)(?:-?й)?\s*(власник|власниц)/giu,
    read: (m) => parseNumber(m[1]),
    tolerance: 0,
  },
];

export function checkNumbers(texts: Texts, input: ListingAiInput): ListingAiFlag[] {
  return texts.flatMap(({ field, text }) =>
    NUMBER_CLAIMS.flatMap((claim) =>
      [...text.matchAll(claim.pattern)].flatMap((match): ListingAiFlag[] => {
        const cited = claim.read(match);
        const expected = input[claim.sourceField];
        const allowed = Math.max(expected * claim.tolerance, 0.05);
        return cited !== null && Math.abs(cited - expected) <= allowed
          ? []
          : [
              {
                reason: 'unsupported',
                claim: match[0].trim(),
                sourceField: claim.sourceField,
                field,
              },
            ];
      }),
    ),
  );
}

const PRICE =
  /[$€₴]|(?<![\p{L}\d])(грн|гривень|гривні|гривня|usd|eur|uah|долар\p{L}*|дол\.|євро|у\.\s?о\.?|ціна|ціни|ціною|ціну|вартість|вартості|коштує)(?![\p{L}\d])/giu;
const URL = /(https?:\/\/|www\.)\S+/giu;
const EMAIL = /(?<![\w.+-])[\w.+-]+@[\w-]+\.[\w.]+/giu;
const MESSENGER = /(?<![\p{L}\d])(telegram|viber|whatsapp|телеграм|вайбер)(?![\p{L}\d])/giu;
const VIN = /(?<![\p{L}\d])[A-HJ-NPR-Z0-9]{17}(?![\p{L}\d])/giu;
// Ten or more digits in one run of digits and separators.
const PHONE = /\+?\d[\d\s(). -]{8,}\d/gu;

/** Words the prompt itself forbids; checked on normalised text, so stems cover the forms. */
const DEFAULT_BANNED: readonly RegExp[] = [
  /(?<![\p{L}\d])ідеальн(ий|а|е|і|ого|ої|ому|ій|им|их|ими|ою)(?![\p{L}\d])/giu,
  /(?<![\p{L}\d])бездоганн\p{L}*/giu,
  /(?<![\p{L}\d])як нов\p{L}*/giu,
  /без жодного недоліку/giu,
];

type Hit = { claim: string; field: ListingAiField };
const hits = (pattern: RegExp, text: string, field: ListingAiField): Hit[] =>
  [...text.matchAll(pattern)].map((m) => ({ claim: m[0].trim(), field }));

function bannedPatterns(voice?: ListingAiBrandVoice): RegExp[] {
  const owner = (voice?.bannedWords ?? [])
    .map((word) => normalizeText(word))
    .filter(Boolean)
    .map((word) => new RegExp(`${NOT_AFTER_WORD}${escapeRegExp(word)}${NOT_BEFORE_WORD}`, 'giu'));
  return [...DEFAULT_BANNED, ...owner];
}

export function checkForbidden(texts: Texts, voice?: ListingAiBrandVoice): ListingAiFlag[] {
  const banned = bannedPatterns(voice);
  return texts
    .flatMap(({ field, text }): Hit[] => {
      const vins = hits(VIN, text, field).filter(
        (hit) => /\d/.test(hit.claim) && /[a-z]/i.test(hit.claim),
      );
      // A VIN's digit tail must not be reported a second time as a phone number.
      const withoutVins = vins.reduce((rest, vin) => rest.split(vin.claim).join(' '), text);
      const normalized = normalizeText(text);
      return [
        ...hits(PRICE, text, field),
        ...hits(URL, text, field),
        ...hits(EMAIL, text, field),
        ...hits(MESSENGER, text, field),
        ...vins,
        ...hits(PHONE, withoutVins, field).filter(
          (hit) => hit.claim.replace(/\D/g, '').length >= 10,
        ),
        ...banned.flatMap((pattern) => hits(pattern, normalized, field)),
      ];
    })
    .map((hit): ListingAiFlag => ({ reason: 'forbidden_content', sourceField: null, ...hit }));
}

const BARGAIN = /(?<![\p{L}\d])(торг|торгу|торгом|поторгуємося|поторгуватися)(?![\p{L}\d])/giu;

/** "Торг" only when the listing allows it. */
export function checkBargain(texts: Texts, input: ListingAiInput): ListingAiFlag[] {
  if (input.isNegotiable) return [];
  return texts.flatMap(({ field, text }) =>
    hits(BARGAIN, text, field).map(
      (hit): ListingAiFlag => ({ reason: 'unsupported', sourceField: 'isNegotiable', ...hit }),
    ),
  );
}
