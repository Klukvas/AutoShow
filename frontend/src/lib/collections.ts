import type { ListingsQuery } from '@/lib/api/types';

/**
 * Curated catalog collections: filter presets rendered as standalone SEO
 * pages (/collections/[key]). Keys are mirrored in the backend sitemap
 * (src/modules/sitemap/sitemap.service.ts) — keep the lists in sync.
 */
export interface CollectionPreset {
  readonly key: string;
  readonly emoji: string;
  readonly titleUk: string;
  readonly descriptionUk: string;
  readonly query: ListingsQuery;
}

export const COLLECTIONS: readonly CollectionPreset[] = [
  {
    key: 'family',
    emoji: '👨‍👩‍👧',
    titleUk: 'Сімейні авто',
    descriptionUk: 'Просторі та безпечні автомобілі для родини — кросовери й універсали з перевіреною історією.',
    query: { bodyType: 'suv' },
  },
  {
    key: 'budget',
    emoji: '💰',
    titleUk: 'Бюджетні до $25 000',
    descriptionUk: 'Перевірені автомобілі з найкращим співвідношенням ціни та стану — до 25 тисяч доларів.',
    query: { priceMax: 25000 },
  },
  {
    key: 'electric',
    emoji: '⚡',
    titleUk: 'Електро та гібриди',
    descriptionUk: 'Електромобілі та гібриди — мінімальні витрати на паливо й обслуговування.',
    query: { fuelType: 'electric' },
  },
  {
    key: 'business',
    emoji: '💼',
    titleUk: 'Бізнес-клас',
    descriptionUk: 'Седани бізнес-класу для комфортних поїздок — представницький вигляд і багата комплектація.',
    query: { bodyType: 'sedan', priceMin: 30000 },
  },
  {
    key: 'suv',
    emoji: '🚙',
    titleUk: 'Позашляховики та кросовери',
    descriptionUk: 'Повний привід і високий кліренс — упевненість на будь-якій дорозі в будь-яку погоду.',
    query: { bodyType: 'suv', driveType: 'awd' },
  },
];

export function collectionByKey(key: string): CollectionPreset | undefined {
  return COLLECTIONS.find((c) => c.key === key);
}

/** /cars URL with this collection's filters applied (for "see all" links). */
export function collectionCatalogHref(preset: CollectionPreset): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(preset.query)) {
    if (v !== undefined) params.set(k, String(v));
  }
  return `/cars?${params.toString()}`;
}
