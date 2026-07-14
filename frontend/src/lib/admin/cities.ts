/**
 * Cities offered in the listing form dropdown. `locationCity` is stored as a
 * plain string (no FK), so this list can be extended freely without touching
 * existing listings. Kyiv first, the rest alphabetically.
 */
export const UKRAINIAN_CITIES: readonly string[] = [
  'Київ',
  'Вінниця',
  'Дніпро',
  'Житомир',
  'Запоріжжя',
  'Івано-Франківськ',
  'Кривий Ріг',
  'Кропивницький',
  'Луцьк',
  'Львів',
  'Миколаїв',
  'Одеса',
  'Полтава',
  'Рівне',
  'Суми',
  'Тернопіль',
  'Ужгород',
  'Харків',
  'Херсон',
  'Хмельницький',
  'Черкаси',
  'Чернівці',
  'Чернігів',
];

/**
 * Options for the city select: the fixed list plus the currently saved value
 * (legacy/free-form data) so editing an old listing never silently changes it.
 */
export function cityOptions(current?: string | null): readonly string[] {
  if (!current || UKRAINIAN_CITIES.includes(current)) return UKRAINIAN_CITIES;
  return [current, ...UKRAINIAN_CITIES];
}
