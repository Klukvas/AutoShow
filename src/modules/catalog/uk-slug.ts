/**
 * Ukrainian → latin kebab slug (official 2010 KMU transliteration, lowercased).
 * Follows frontend/src/lib/admin/slugify.ts so server-generated slugs look
 * like the ones the admin UI produces; apostrophes are dropped, as KMU does.
 */
const UK_TO_LATIN: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  // Russian-only letters typed by mistake — map to something sane.
  ы: 'y',
  э: 'e',
  ё: 'e',
  ъ: '',
};

export const MAX_CATALOG_SLUG_LENGTH = 64;

const APOSTROPHES = /['\u2019\u02bc`]/g;

export function ukSlug(input: string, maxLength = MAX_CATALOG_SLUG_LENGTH): string {
  // NFC first so a decomposed й/ї (base + combining mark) hits the table;
  // the later NFKD only strips accents left on latin letters.
  return [...input.normalize('NFC').toLowerCase().replace(APOSTROPHES, '')]
    .map((char) => UK_TO_LATIN[char] ?? char)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * First of `base`, `base-2`, `base-3`… not in `taken`, kept within the slug
 * length limit by trimming the base before the suffix.
 */
export function firstFreeSlug(
  base: string,
  taken: ReadonlySet<string>,
  maxLength = MAX_CATALOG_SLUG_LENGTH,
): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const head = base.slice(0, maxLength - suffix.length).replace(/-+$/g, '');
    const candidate = `${head}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
