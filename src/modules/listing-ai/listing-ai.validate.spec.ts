import type { ListingAiInput } from './listing-ai.input';
import type { ListingAiResult } from './listing-ai.types';
import { normalizeText, parseGrouped, parseNumber } from './listing-ai.text';
import { validateListingAiResult } from './listing-ai.validate';

const input: ListingAiInput = {
  make: 'BMW',
  model: 'X5',
  generation: 'G05',
  modification: null,
  year: 2021,
  mileageKm: 45000,
  bodyType: 'Позашляховик',
  fuelType: 'Дизель',
  transmission: 'Автомат',
  driveType: 'Повний',
  color: 'Чорний',
  engineVolumeL: 3,
  powerHp: 286,
  condition: 'used',
  ownersCount: 1,
  isCrashed: false,
  customsCleared: true,
  isNegotiable: false,
  locationCity: 'Київ',
  locationRegion: null,
  options: [
    { category: 'comfort', name: 'Підігрів сидінь' },
    { category: 'safety', name: 'Камера заднього виду' },
  ],
  tags: ['Перевірено'],
};

const clean: ListingAiResult = {
  description:
    'BMW X5 G05 2021 року з дизельним двигуном 3.0 л потужністю 286 к.с. Пробіг 45 000 км, один власник. Повний привід і автомат. У салоні є підігрів сидінь, а камера заднього виду допоможе паркуватися. Запишіться на огляд у Києві.',
  metaTitle: 'BMW X5 2021, дизель 3.0, 45 тис. км',
  metaDescription: 'BMW X5 G05 2021 року, 286 к.с., повний привід. Перегляньте оголошення.',
  facts: [
    { claim: 'BMW X5', sourceField: 'make', value: 'BMW' },
    { claim: '2021 року', sourceField: 'year', value: '2021' },
    { claim: 'Пробіг 45 000 км', sourceField: 'mileageKm', value: '45 000' },
    { claim: '3.0 л', sourceField: 'engineVolumeL', value: '3.0' },
    { claim: 'підігрів сидінь', sourceField: 'options', value: 'підігрів сидінь' },
    { claim: 'автомат', sourceField: 'transmission', value: 'Автомат' },
    { claim: 'не після ДТП', sourceField: 'isCrashed', value: 'false' },
  ],
};

const flagsOf = (result: Partial<ListingAiResult>, overrides: Partial<ListingAiInput> = {}) =>
  validateListingAiResult({ ...clean, ...result }, { ...input, ...overrides }, 'standard').flags;

/** Checks one description alone, with neutral SEO texts and no facts. */
const textFlags = (description: string, overrides: Partial<ListingAiInput> = {}) =>
  flagsOf(
    { description, metaTitle: 'BMW X5', metaDescription: 'Перегляньте оголошення.', facts: [] },
    overrides,
  );

describe('validateListingAiResult', () => {
  it('passes a draft whose facts and numbers all match the listing', () => {
    expect(flagsOf({})).toEqual([]);
  });

  it('flags facts with an unknown field, a wrong value or an empty source field', () => {
    const flags = flagsOf({
      facts: [
        { claim: 'сервісна книжка', sourceField: 'serviceHistory', value: 'так' },
        { claim: 'Пробіг 40 000 км', sourceField: 'mileageKm', value: '40000' },
        { claim: 'люк', sourceField: 'options', value: 'Люк' },
        { claim: 'версія M50d', sourceField: 'modification', value: 'M50d' },
        { claim: 'бензин', sourceField: 'fuelType', value: 'Бензин' },
      ],
    });
    expect(flags.map((f) => [f.reason, f.sourceField])).toEqual([
      ['unknown_field', 'serviceHistory'],
      ['mismatch', 'mileageKm'],
      ['mismatch', 'options'],
      ['unsupported', 'modification'],
      ['mismatch', 'fuelType'],
    ]);
  });

  it('catches numbers in the text that the facts list left out', () => {
    const flags = flagsOf({
      description:
        'BMW X5 2019 року, пробіг лише 30 тис. км, мотор 2.0 л на 190 к.с., два власники: 2 власники.',
    });
    expect(flags.map((f) => [f.sourceField, f.claim])).toEqual([
      ['mileageKm', '30 тис. км'],
      ['powerHp', '190 к.с.'],
      ['engineVolumeL', '2.0 л'],
      ['year', '2019'],
      ['ownersCount', '2 власник'],
    ]);
    expect(new Set(flags.map((f) => f.reason))).toEqual(new Set(['unsupported']));
  });

  it('accepts rounded mileage and keeps units and years apart', () => {
    expect(
      flagsOf({ description: 'Пробіг близько 45 тис. км, рік 2021, 2021, 45 000 км.' }),
    ).toEqual([]);
    // 2000 km must not be read as the year 2000.
    expect(textFlags('Пробіг 2000 км.', { mileageKm: 2000 })).toEqual([]);
  });

  it('flags price, contacts, messengers and a VIN-like token', () => {
    const flags = flagsOf({
      description:
        'Ціна 31 000 $ або 1 200 000 грн. Дзвоніть +380 67 123 45 67, пишіть у Telegram, info@dealer.ua, https://dealer.ua. VIN WBA12345678901234.',
    });
    const claims = flags.filter((f) => f.reason === 'forbidden_content').map((f) => f.claim);
    for (const expected of [
      '$',
      'грн',
      '+380 67 123 45 67',
      'Telegram',
      'info@dealer.ua',
      'https://dealer.ua.',
      'WBA12345678901234',
    ])
      expect(claims).toContain(expected);
    // Mileage digits are not a phone number.
    expect(textFlags('Пробіг 145 000 км.', { mileageKm: 145000 })).toEqual([]);
  });

  it('requires accident, customs and damage disclosures when the data says so', () => {
    const flags = flagsOf({}, { isCrashed: true, customsCleared: false, condition: 'damaged' });
    expect(
      flags.filter((f) => f.reason === 'missing_disclosure').map((f) => f.sourceField),
    ).toEqual(['isCrashed', 'customsCleared', 'condition']);
    const disclosed = flagsOf(
      { description: `${clean.description} Авто після ДТП. Авто не розмитнене. Авто пошкоджене.` },
      { isCrashed: true, customsCleared: false, condition: 'damaged' },
    );
    expect(disclosed.filter((f) => f.reason === 'missing_disclosure')).toEqual([]);
  });

  it('flags a mention of bargaining when the listing is not negotiable', () => {
    const text = `${clean.description} Можливий торг.`;
    expect(flagsOf({ description: text })).toEqual([
      { reason: 'unsupported', claim: 'торг', sourceField: 'isNegotiable', field: 'description' },
    ]);
    expect(flagsOf({ description: text }, { isNegotiable: true })).toEqual([]);
  });

  it('flags texts over the preset and SEO limits', () => {
    const flags = flagsOf({
      description: 'а'.repeat(1500),
      metaTitle: 'б'.repeat(61),
      metaDescription: 'в'.repeat(161),
    });
    expect(flags.filter((f) => f.reason === 'too_long').map((f) => f.field)).toEqual([
      'description',
      'metaTitle',
      'metaDescription',
    ]);
  });

  it('flags brand-banned words as whole words only, any case', () => {
    const flags = validateListingAiResult(
      { ...clean, description: `${clean.description} Ідеальний вибір! Неідеальний — ні.` },
      input,
      'standard',
      { bannedWords: ['ідеальний', ' '] },
    ).flags;
    expect(flags).toEqual([
      { reason: 'forbidden_content', claim: 'ідеальний', sourceField: null, field: 'description' },
    ]);
  });

  it('reports the same problem once per text', () => {
    const flags = flagsOf({ metaTitle: 'BMW X5 2019', metaDescription: 'BMW X5 2019, 2019 рік' });
    expect(flags.map((f) => f.field)).toEqual(['metaTitle', 'metaDescription']);
  });
});

describe('honesty disclosures', () => {
  const crashed = { isCrashed: true };
  it.each([
    ['Не був у ДТП, не битий, не фарбований.', crashed, 'isCrashed'],
    ['Без ДТП.', crashed, 'isCrashed'],
    ['Кузов не пошкоджений.', { condition: 'damaged' as const }, 'condition'],
    ['Без пошкоджень.', { condition: 'damaged' as const }, 'condition'],
    ['Авто розмитнене.', { customsCleared: false }, 'customsCleared'],
  ])('flags a denial of a stated problem: %s', (text, data, sourceField) => {
    const flags = textFlags(text, data);
    expect(flags.filter((f) => f.reason === 'mismatch').map((f) => f.sourceField)).toContain(
      sourceField,
    );
    expect(
      flags.filter((f) => f.reason === 'missing_disclosure').map((f) => f.sourceField),
    ).toEqual([sourceField]);
  });

  it.each([
    ['ДТП не було, кузов рідний.', crashed, 'isCrashed'],
    ['Не брав участі в ДТП.', crashed, 'isCrashed'],
    ['Без участі в ДТП.', crashed, 'isCrashed'],
    ['ДТП не зафіксовано.', crashed, 'isCrashed'],
    ['Небите авто.', crashed, 'isCrashed'],
    ['Пошкоджень немає, все рідне.', { condition: 'damaged' as const }, 'condition'],
    ['Немає пошкоджень.', { condition: 'damaged' as const }, 'condition'],
    ['Авто не має пошкоджень.', { condition: 'damaged' as const }, 'condition'],
  ])('flags a denial in natural word order: %s', (text, data, sourceField) => {
    expect(textFlags(text, data).map((f) => [f.reason, f.sourceField])).toEqual(
      expect.arrayContaining([
        ['mismatch', sourceField],
        ['missing_disclosure', sourceField],
      ]),
    );
  });

  it.each(['ДТП не було.', 'Пошкоджень немає.', 'Небите авто без дефектів.'])(
    'accepts a denial when the data agrees: %s',
    (text) => {
      expect(textFlags(text)).toEqual([]);
    },
  );

  it('reads each clause on its own', () => {
    // A denial of one problem does not deny another in the next sentence.
    expect(textFlags('Авто після ДТП. Не фарбоване.', crashed)).toEqual([]);
    expect(textFlags('ДТП не було. Має пошкодження бампера.', { condition: 'damaged' })).toEqual(
      [],
    );
    expect(textFlags('Авто після ДТП. Пошкоджень немає.', crashed)).toEqual([]);
  });

  it.each([
    ['Авто після ДТП.', 'isCrashed'],
    ['Авто не розмитнене.', 'customsCleared'],
    ['Є пошкодження бампера: пошкоджений бампер.', 'condition'],
  ])('flags a problem the data does not state: %s', (text, sourceField) => {
    expect(textFlags(text).map((f) => [f.reason, f.sourceField])).toContainEqual([
      'unsupported',
      sourceField,
    ]);
  });

  it('accepts honest phrasing and a clean car described as such', () => {
    expect(
      textFlags('Авто після ДТП. Авто не розмитнене. Кузов пошкоджений.', {
        isCrashed: true,
        customsCleared: false,
        condition: 'damaged',
      }),
    ).toEqual([]);
    expect(textFlags('Авто без ДТП, розмитнене, без пошкоджень.')).toEqual([]);
  });
});

describe('disclosures fail safe', () => {
  const crashed = { isCrashed: true };
  const damaged = { condition: 'damaged' as const };
  const notCleared = { customsCleared: false };
  const reasons = (text: string, data: Parameters<typeof textFlags>[1]) =>
    textFlags(text, data).map((f) => f.reason);

  it.each([
    ['Жодних ДТП.', crashed],
    ['Ніяких ДТП, чиста історія.', crashed],
    ['Не після ДТП.', crashed],
    ['Авто не з ДТП.', crashed],
    ['Автомобіль у ДТП не був.', crashed],
    ['У ДТП не брало участі.', crashed],
    ['Історія ДТП чиста.', crashed],
    ['ДТП\nне було.', crashed],
    ['Не бито, не крашено.', crashed],
    ['Аварійна сигналізація та ударостійкі диски.', crashed],
    ['Жодних пошкоджень кузова.', damaged],
    ['Дефектів не має.', damaged],
    ['Дефектів лакофарбового покриття немає.', damaged],
    ['Пошкоджень не помічено.', damaged],
    ['Авто розмитнене.', notCleared],
    ['Пошкоджень не видно.', damaged],
    ['Пошкоджень кузова не видно.', damaged],
    ['Пошкодження не потребують ремонту.', damaged],
    ['Було не ДТП, а подряпина.', crashed],
    ['Є авто без ДТП.', crashed],
    ['Розмитнення не потрібне.', notCleared],
    ['Розмитнення не вимагається, авто на обліку.', notCleared],
    ['Був у ДТП? Ні.', crashed],
    ['Після ДТП — ні.', crashed],
    ['Був у ДТП? Ніколи.', crashed],
    ['Було в ДТП? Звісно, ні.', crashed],
    ['Є пошкодження? Відсутні.', damaged],
    ['Видно пошкодження? Не видно.', damaged],
    ['Авто не на єврономерах.', notCleared],
    ['Пошкоджень: 0.', damaged],
    ['Було 0 ДТП.', crashed],
    ['Учасником ДТП не є.', crashed],
    ['Історія прозора: ДТП було 0, власник один.', crashed],
    ['Аварій було нуль.', crashed],
    ['Був у ДТП? — Ні.', crashed],
    ['Був у ДТП? Аж ніяк.', crashed],
    ['Пошкодження є? Все чисто.', damaged],
    ['Зафіксованих ДТП за весь час експлуатації не виявлено.', crashed],
    ['Пошкоджень від граду та ДТП немає, кузов доглянутий.', damaged],
    ['Автомобіль учасником ДТП не виступав, усі деталі рідні.', crashed],
    ['Кузов не виглядає битим.', crashed],
    ['Авто пошкодженим не вважається: лише дрібні подряпини.', damaged],
    ['Авто на єврономерах не їздило, одразу поставлене на облік.', notCleared],
    ['Це не авто після ДТП: кузов оригінальний.', crashed],
    ['Авто не під іноземною реєстрацією.', notCleared],
    ['Бите, фарбоване? Ні. Все рідне.', crashed],
    ['Авто пошкоджене, ні.', damaged],
    ['Був у ДТП?! Ні.', crashed],
    ['Був у ДТП?.. Ні.', crashed],
    ['Було на єврономерах, зараз на обліку в Україні.', notCleared],
    ['Пошкодження: усунуто.', damaged],
    ['Пошкоджений бампер замінено на новий.', damaged],
    ['Після ДТП — виключено.', crashed],
    ['Був у ДТП — вигадка конкурентів.', crashed],
    ['Ані дефектів від ДТП, ані слідів фарбування.', crashed],
    ['Жоден дефект на фото.', damaged],
  ])('never stays silent when the data states a problem: %s', (text, data) => {
    expect(reasons(text, data)).toContain('missing_disclosure');
  });

  it.each([
    ['Був у невеликому ДТП, відновлений.', crashed],
    ['Авто після ДТП. Не фарбоване.', crashed],
    ['Авто бите, продається як є.', crashed],
    ['Пошкоджений бампер. На їзду не впливає.', damaged],
    ['Є незначні пошкодження лаку.', damaged],
    ['Без розмитнення.', notCleared],
    ['Авто не розмитнене, розмитнення коштуватиме окремо.', notCleared],
    ['Потребує розмитнення.', notCleared],
    ['Авто з ДТП.', crashed],
    ['Був учасником ДТП.', crashed],
    ['Було 2 ДТП.', crashed],
    ['Биті обидві сторони.', crashed],
    ['Потребує ремонту кузова.', damaged],
    ['Авто з пошкодженнями.', damaged],
    ['Пошкодження: бампер та крило.', damaged],
    ['Пошкодження незначні.', damaged],
    ['Розмитнення — за рахунок покупця.', notCleared],
    ['Розмитнення ще не включено.', notCleared],
    ['Авто на єврономерах.', notCleared],
    ['Зараз на єврономерах.', notCleared],
    ['Авто з єврономерами.', notCleared],
    ['Авто не розмитнене, на обліку в Литві.', notCleared],
    ['Розмитнення потрібне.', notCleared],
    ['Доведеться розмитнити.', notCleared],
    ['Пошкодження серйозні.', damaged],
    ['Потребує косметичного ремонту.', damaged],
  ])('accepts an honest disclosure: %s', (text, data) => {
    expect(textFlags(text, data)).toEqual([]);
  });

  it.each([
    ['Після ДТП не фарбоване.', crashed],
    ['Пошкоджений бампер, не впливає на їзду.', damaged],
  ])(
    'asks for a separate sentence when a disclosure shares one with a negation: %s',
    (text, data) => {
      // Accepted trade-off: the prompt asks for "Авто після ДТП." as its own sentence.
      expect(reasons(text, data)).toEqual(['missing_disclosure']);
    },
  );

  it.each([
    'Ударостійкий бампер, аварійна сигналізація, захист від ударів каміння.',
    'Дефектів лакофарбового покриття немає.',
    'Жодних ДТП і дефектів, ніяких прихованих дефектів.',
    'Розмитнене, розмитнення сплачене.',
    'Пошкоджень не видно.',
    'Є історія без ДТП.',
    'Розмитнення не потрібне, все сплачено.',
    'Автоматичний виклик служб після ДТП.',
    'Є асистент, який після удару гальмує.',
    'Після удару спрацьовують подушки безпеки.',
    'Пошкоджень: немає.',
    'Перевірено на наявність пошкоджень.',
    'Не на єврономерах.',
    'Пошкодження: 0.',
    'Захист від дрібних пошкоджень.',
    'Авто на обліку в Україні.',
  ])('does not invent a problem for a clean car: %s', (text) => {
    expect(textFlags(text)).toEqual([]);
  });

  it.each([
    ['Потребує розмитнення.', 'customsCleared'],
    ['Авто після аварії.', 'isCrashed'],
    ['Є дрібні дефекти бампера.', 'condition'],
  ])('flags a problem the clean data does not state: %s', (text, sourceField) => {
    expect(textFlags(text).map((f) => [f.reason, f.sourceField])).toContainEqual([
      'unsupported',
      sourceField,
    ]);
  });
});

describe('false-positive guards', () => {
  it.each([
    'Торгова марка BMW, торгівельний центр поруч.',
    'Витрата 6 л на 100 км, у місті 7,5 л/100 км.',
    'Багажник 650 л, бак 80 л.',
    'Пробіг 45.000 км, 45k км.',
    'Модель 2021-го, з 2021 р., 1-й власник.',
    'Розгін до 100 км/год, максимальна швидкість 210 км/год, до 100 км за годину.',
    'Швидкість 210 км на годину, 180 км/ч, 150 км/г, 200 км в годину.',
    'Маса 2000 кг, потужність 210 кВт.',
    'Ідеально підходить для міста.',
  ])('does not flag: %s', (text) => {
    expect(textFlags(text)).toEqual([]);
  });

  it('checks an integer engine volume and a dot-separated phone', () => {
    expect(textFlags('Двигун 2 л.').map((f) => f.sourceField)).toEqual(['engineVolumeL']);
    expect(textFlags('Дзвоніть 067.123.45.67').map((f) => f.claim)).toEqual(['067.123.45.67']);
  });

  it('reports a VIN once, in any case, and other price words', () => {
    expect(textFlags('VIN wba12345678901234.').map((f) => f.claim)).toEqual(['wba12345678901234']);
    const claims = textFlags('Ціна 31 000 дол. або 31 000 у.о.').map((f) => f.claim);
    expect(claims).toEqual(expect.arrayContaining(['Ціна', 'дол.', 'у.о.']));
  });

  it('enforces the prompt’s own banned words and matches owner words after normalising', () => {
    expect(
      textFlags('Ідеальний стан, як новий, бездоганно доглянутий!').map((f) => f.claim),
    ).toEqual(['ідеальний', 'бездоганно', 'як новий']);
    const flags = validateListingAiResult(
      { ...clean, description: `${clean.description} Пам’ять  сидінь.` },
      input,
      'standard',
      { bannedWords: ["пам'ять сидінь"] },
    ).flags;
    expect(flags.map((f) => f.claim)).toEqual(["пам'ять сидінь"]);
  });

  it('stays fast on long adversarial tokens', () => {
    const started = Date.now();
    for (const token of [
      'A'.repeat(8000),
      '1-'.repeat(4000),
      'www.' + 'a'.repeat(8000),
      'a'.repeat(4000) + '@',
    ])
      textFlags(token);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('number and text normalisation', () => {
  it('reads thousands groups with spaces or dots', () => {
    expect(parseGrouped('45.000')).toBe(45000);
    expect(parseGrouped('1 200 000')).toBe(1200000);
    expect(parseGrouped('3.5')).toBe(3.5);
  });

  it('parses grouped and comma-decimal numbers only', () => {
    expect(parseNumber('45 000')).toBe(45000);
    expect(parseNumber('45 000')).toBe(45000);
    expect(parseNumber('2,0')).toBe(2);
    expect(parseNumber('45 тис')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
  it('unifies case, apostrophes and spaces', () => {
    expect(normalizeText('  Пам’ять   СИДІНЬ ')).toBe("пам'ять сидінь");
  });
});
