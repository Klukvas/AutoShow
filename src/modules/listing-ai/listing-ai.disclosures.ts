import type { ListingAiInput } from './listing-ai.input';
import type { Texts } from './listing-ai.text-checks';
import type { ListingAiField, ListingAiFlag } from './listing-ai.types';

/**
 * Honesty disclosures: an accident, damage or missing customs clearance must
 * be stated when the data says so, and no text may deny it — nor state such
 * a problem when the data does not.
 *
 * Ukrainian has too many ways to deny something to list them all, so the
 * check is built to fail safe, and the prompt asks for exactly what it
 * accepts: a disclosure only counts as its own sentence, in an explicitly
 * affirmative form, with no negation word anywhere in that sentence
 * ("Авто після ДТП."). Any other wording — "Жодних ДТП", "ДТП було 0", or a
 * phrasing nobody listed yet — leaves the disclosure missing, which is
 * flagged. Recognised denials add a stronger `mismatch` flag on top; a text
 * that both discloses and denies in an unrecognised way is the one residual
 * gap, and it contradicts itself in plain sight of the owner.
 */

type Mention = { claim: string; field: ListingAiField };

type Disclosure = {
  sourceField: keyof ListingAiInput;
  /** True when the listing data says the problem exists. */
  present: (input: ListingAiInput) => boolean;
  /** Affirmative statements of the problem. */
  states: RegExp;
  /** Words that, when negated, deny the problem. */
  keyword?: RegExp;
  /** Phrases that deny it on their own, whatever the context. */
  denials?: RegExp;
  /** Customs states the problem with a negation ("не розмитнене"), so it must not count as one. */
  negationStates?: boolean;
  claim: string;
};

/** A paragraph break or sentence punctuation ends a clause; a soft line break does not. */
// A question answered in place ("Був у ДТП? Ні.") stays one clause.
const CLAUSE =
  /\n{2,}|[.!;,]+|\?+(?!\s*(?:ні|не(?![\p{L}])|нема|немає|жодн|ніяк|ніколи|відсутн|звісно|звичайно|точно|однозначно))|\s(?:але|проте|однак|хоча)\s/iu;

const NEGATION =
  'без|немає|нема|відсутн\\p{L}*|жодн\\p{L}*|жоден|ані|ніяк\\p{L}*|ніколи|ні|не\\s+(був|була|було|бувал\\p{L}*|брав|брала|брало|потрапля\\p{L}*|побува\\p{L}*|має|мав|мала|мало|виявлено|знайдено|помічено|зафіксован\\p{L}*|спостеріга\\p{L}*|є|з|із|після|на|учасник\\p{L}*)';
const NEGATED_VERB =
  'не\\s+(був|була|було|бувал\\p{L}*|брал\\p{L}*|брав|потрапля\\p{L}*|побува\\p{L}*|має|мав|мала|мало|виявлено|знайдено|помічено|зафіксован\\p{L}*|спостеріга\\p{L}*|траплял\\p{L}*|є|значиться|числиться|зареєстрован\\p{L}*|видно)|немає|нема|відсутн\\p{L}*|жодн\\p{L}*|ніяк\\p{L}*|чист\\p{L}*|ніколи|ні\\s+разу|ні';
// Negation within four words before a keyword, or ending right before it ("не бите").
const DENIAL_BEFORE = new RegExp(
  `(?<![\\p{L}\\d])(${NEGATION})(?![\\p{L}\\d])|(?<![\\p{L}\\d])не$`,
  'iu',
);
// Negation after a keyword, possibly past two attribute words ("Дефектів лаку немає").
const DENIAL_AFTER = new RegExp(`^(?:\\S+\\s+){0,2}?(${NEGATED_VERB})(?![\\p{L}\\d])`, 'iu');

// A negation inside the matched words themselves ("Пошкоджень не видно").
const NEGATION_INSIDE =
  /(?<![\p{L}\d])(не|ні|без|нема|немає|жодн\p{L}*|ніяк\p{L}*|відсутн\p{L}*)(?![\p{L}\d])/iu;

const words = (text: string) => text.split(/\s+/).filter(Boolean);

function negatedAt(clause: string, start: number, length: number, inside: boolean): boolean {
  const before = words(clause.slice(0, start)).slice(-4).join(' ');
  const after = words(clause.slice(start + length))
    .slice(0, 5)
    .join(' ');
  const span = clause.slice(start, start + length);
  return (
    DENIAL_BEFORE.test(before) || DENIAL_AFTER.test(after) || (inside && NEGATION_INSIDE.test(span))
  );
}

type Classified = { statements: Mention[]; denials: Mention[] };

/** Sentences with their end mark; a question never states anything. */
const SENTENCES = /[^.!?\n]+[.!?]*/gu;
/** Any negation at all, including zero counts and "небитий"-style prefixes. */
const ANY_NEGATION =
  /(?<![\p{L}\d])(не|ні|ніколи|ніяк\p{L}*|без|нема|немає|жодн\p{L}*|відсутн\p{L}*|0|нуль\p{L}*|нульов\p{L}*|чист\p{L}*|небит\p{L}*|ані|жоден|ніде|ніхто|нічого|ніщо|виключен\p{L}*|неправд\p{L}*|вигадк\p{L}*|міф|брехн\p{L}*|чутк\p{L}*|навряд|малоймовірн\p{L}*|ноль|усунут\p{L}*|відремонтован\p{L}*|виправлен\p{L}*|полагоджен\p{L}*|ліквідован\p{L}*|замінен\p{L}*)(?![\p{L}\d])/iu;

/**
 * Statements whose whole sentence is free of negation. Customs states its
 * problem with "не" ("не розмитнене"), so only the rest of its sentence is checked.
 */
function affirmativeStatements(rule: Disclosure, text: string, field: ListingAiField): Mention[] {
  const sentences = [...text.matchAll(SENTENCES)]
    .map((m) => m[0])
    .filter((sentence) => !sentence.includes('?'));
  return sentences.flatMap((sentence) =>
    [...sentence.matchAll(rule.states)]
      .filter((m) => {
        const rest = rule.negationStates
          ? sentence.slice(0, m.index ?? 0) + ' ' + sentence.slice((m.index ?? 0) + m[0].length)
          : sentence;
        return !ANY_NEGATION.test(rest);
      })
      .map((m) => ({ claim: m[0].trim(), field })),
  );
}

function classify(rule: Disclosure, text: string, field: ListingAiField): Classified {
  const clauses = text
    .replace(/(?<!\n)\n(?!\n)/g, ' ')
    // "Звісно, ні" is one answer: keep its "ні" in the question's clause.
    .replace(/(?<![\p{L}\d])(звісно|звичайно|точно|однозначно|ну),\s*/giu, '$1 ')
    .split(CLAUSE);
  return clauses.reduce<Classified>(
    (acc, clause) => {
      const negatedKeywords = [...(rule.keyword ? clause.matchAll(rule.keyword) : [])]
        .filter((m) => negatedAt(clause, m.index ?? 0, m[0].length, true))
        .map((m) => ({ claim: m[0].trim(), field }));
      const fixed = rule.denials
        ? [...clause.matchAll(rule.denials)].map((m) => ({ claim: m[0].trim(), field }))
        : [];
      return { ...acc, denials: [...acc.denials, ...negatedKeywords, ...fixed] };
    },
    { statements: affirmativeStatements(rule, text, field), denials: [] },
  );
}

const CRASH_NOUN = '(дтп|аварі(я|ї|ю|єю|й|ях|ям|ями))';
// Up to N words between the parts of a phrase; never a negation, which would hide inside the match.
const GAP =
  '((?!(?:не|ні|без|нема\\p{L}*|жодн\\p{L}*|ніяк\\p{L}*|відсутн\\p{L}*|0|нуль\\p{L}*|нульов\\p{L}*)(?![\\p{L}\\d]))[\\p{L}\\d]+\\s+)';
// Safety features run "after an accident": eCall, multi-collision braking, airbags.
const NOT_A_FEATURE =
  '(?<!(?:виклик\\p{L}*|допомог\\p{L}*|служб\\p{L}*|гальмуванн\\p{L}*|безпек\\p{L}*)\\s+)';
const BIT = 'бит(ий|а|е|о|і|ого|ої|их|ою|им)';
const DAMAGE_NOUN = '(пошкоджен(ня|ням|ь|нями|нях)|дефект(и|ів|ами|ах)?)';
const PARTICIPLE_END = '(ий|а|е|і|ого|ої|ому|ій|им|их|ими|ою|о)';

const DISCLOSURES: readonly Disclosure[] = [
  {
    sourceField: 'isCrashed',
    present: (input) => input.isCrashed,
    states: new RegExp(
      [
        `${NOT_A_FEATURE}(після|внаслідок)\\s+${GAP}{0,2}${CRASH_NOUN}`,
        `(був|була|було|бувал\\p{L}*|побува\\p{L}*|потрапля\\p{L}*|потрапи\\p{L}*|брав|брала|брало)\\s+(участь\\s+)?(у|в)\\s+${GAP}{0,2}${CRASH_NOUN}`,
        `(мав|мала|мало|має|є|було)\\s+${GAP}{0,2}${CRASH_NOUN}`,
        `(з|із|учасник\\p{L}*|зафіксован\\p{L}*)\\s+${GAP}{0,1}${CRASH_NOUN}`,
        `${CRASH_NOUN}\\s*[:\u2014-]?\\s*(було|був|була|так|зафіксован\\p{L}*)`,
        `після\\s+удару(?!\\s+(спрацьов|виклика|гальму|автоматично)\\p{L}*)`,
        BIT,
      ]
        .map((part) => `(?<![\\p{L}\\d])(${part})(?![\\p{L}\\d])`)
        .join('|'),
      'giu',
    ),
    keyword: new RegExp(
      `(?<![\\p{L}\\d])(${CRASH_NOUN}|удар(у|ом|ів|и|ах|ами)?|${BIT})(?![\\p{L}\\d])`,
      'giu',
    ),
    denials: /(?<![\p{L}\d])небит\p{L}*/giu,
    claim: 'Авто після ДТП',
  },
  {
    // Customs reads the other way round: "не розмитнене" states the problem.
    sourceField: 'customsCleared',
    present: (input) => !input.customsCleared,
    states: new RegExp(
      [
        'не\\s*розмитнен\\p{L}*',
        'нерозмитнен\\p{L}*',
        'без\\s+розмитнення',
        '(потребує|під|необхідн\\p{L}*|потрібн\\p{L}*)\\s+розмитнення',
        'розмитнення\\s+(ще\\s+)?не\\s+(включен\\p{L}*|входить|сплачен\\p{L}*|оплачен\\p{L}*|пройден\\p{L}*|зроблен\\p{L}*|виконан\\p{L}*|здійснен\\p{L}*|проводил\\p{L}*)',
        'розмитнення\\s*[:\u2014-]?\\s*((с|о)плачує|платить|за\\s+рахунок\\s+покупця|на\\s+покупц\\p{L}*|за\\s+покупцем|(коштує\\s+)?окремо|ні)',
        'не\\s+(включає|входить|включено)\\s+розмитнення',
        'розмитнення\\s*[:\u2014-]?\\s*(потрібн\\p{L}*|необхідн\\p{L}*|треба|вимагається|потребується|(с|о)плачується\\s+окремо)',
        '(потрібно|необхідно|треба|доведеться)\\s+розмитн\\p{L}*',
        '(?<!(?<![\\p{L}])(?:був|була|було|раніше)\\s+(?:на\\s+)?)(?<!(?<![\\p{L}])(?:з|із)\\s+(?=євроном\\p{L}*(?:ів|а)(?![\\p{L}])))євроном\\p{L}*',
        '(?<!(?<![\\p{L}])(?:був|була|було|раніше)\\s+(?:на\\s+)?)(?<!(?<![\\p{L}])(?:з|із)\\s+(?=євробля\\p{L}*(?:ів|а)(?![\\p{L}])))євробля\\p{L}*',
        'іноземн\\p{L}+\\s+реєстрац\\p{L}*',
      ]
        .map((part) => `(?<![\\p{L}\\d])(${part})(?![\\p{L}\\d])`)
        .join('|'),
      'giu',
    ),
    negationStates: true,
    // Only participles claim clearance; the noun "розмитнення" does not.
    denials: new RegExp(
      `(?<![\\p{L}\\d])((?<!не\\s*)розмитнен${PARTICIPLE_END}|розмитнення\\s+(вже\\s+)?не\\s+(потрібн\\p{L}*|треба|вимагається|потребується)|не\\s+потребує\\s+розмитнення|на\\s+(українськ\\p{L}*\\s+)?обліку(?!\\s+(?:в|у)\\s+(?!україн))|поставлен\\p{L}*\\s+на\\s+облік|переведен\\p{L}*\\s+на\\s+(українськ\\p{L}*\\s+)?облік|українськ\\p{L}+\\s+реєстрац\\p{L}*)(?![\\p{L}\\d])`,
      'giu',
    ),
    claim: 'Авто не розмитнене',
  },
  {
    sourceField: 'condition',
    present: (input) => input.condition === 'damaged',
    states: new RegExp(
      [
        `пошкоджен${PARTICIPLE_END}`,
        `(є|має|мають|наявн(і|ий|а|е)|видно|присутн\\p{L}*|потребує\\s+ремонту)\\s+${GAP}{0,2}${DAMAGE_NOUN}`,
        `(?<!від\\s+)(невелик\\p{L}*|незначн\\p{L}*|дрібн\\p{L}*|косметичн\\p{L}*|серйозн\\p{L}*|значн\\p{L}*|суттєв\\p{L}*|помітн\\p{L}*|видим\\p{L}*)\\s+${DAMAGE_NOUN}`,
        `${DAMAGE_NOUN}\\s+${GAP}{0,3}(є|мають|присутні|видно|потребують|на\\s+фото|зафіксован\\p{L}*|вказан\\p{L}*)`,
        `${DAMAGE_NOUN}\\s+(незначн|невелик|дрібн|мінімальн|косметичн|серйозн|значн|суттєв|помітн|видим)\\p{L}*`,
        `${DAMAGE_NOUN}\\s+(після|внаслідок|від)`,
        `${DAMAGE_NOUN}\\s*[:\u2014-]\\s*(?!(нема|немає|відсутн\\p{L}*|ні|жодн\\p{L}*|0|нуль\\p{L}*|усунут\\p{L}*|відремонтован\\p{L}*|виправлен\\p{L}*|полагоджен\\p{L}*|ліквідован\\p{L}*)(?![\\p{L}\\d]))[\\p{L}\\d]+`,
        `потребує\\s+(\\p{L}+\\s+)?ремонту`,
        `(з|із)\\s+${GAP}{0,2}${DAMAGE_NOUN}`,
      ]
        .map((part) => `(?<![\\p{L}\\d])(${part})(?![\\p{L}\\d])`)
        .join('|'),
      'giu',
    ),
    keyword: new RegExp(
      `(?<![\\p{L}\\d])(${DAMAGE_NOUN}|пошкоджен${PARTICIPLE_END})(?![\\p{L}\\d])`,
      'giu',
    ),
    // "Repaired" claims the damage is gone.
    denials:
      /(?<![\p{L}\d])(пошкодження|дефекти|пошкоджен\p{L}*\s+\p{L}+)\s*[:\u2014-]?\s*(повністю\s+)?(усунут|відремонтован|виправлен|полагоджен|ліквідован|замінен)\p{L}*/giu,
    claim: 'Авто пошкоджене',
  },
];

export function checkDisclosures(texts: Texts, input: ListingAiInput): ListingAiFlag[] {
  return DISCLOSURES.flatMap((rule): ListingAiFlag[] => {
    const present = rule.present(input);
    const found = texts.map(({ field, text }) => classify(rule, text, field));
    const statements = found.flatMap((f) => f.statements);
    const denials = found.flatMap((f) => f.denials);
    const flag = (reason: ListingAiFlag['reason'], m: Mention): ListingAiFlag => ({
      reason,
      claim: m.claim,
      sourceField: rule.sourceField,
      field: m.field,
    });
    if (!present) return statements.map((m) => flag('unsupported', m));
    const stated = statements.some((m) => m.field === 'description');
    return [
      ...denials.map((m) => flag('mismatch', m)),
      ...(stated ? [] : [flag('missing_disclosure', { claim: rule.claim, field: 'description' })]),
    ];
  });
}
