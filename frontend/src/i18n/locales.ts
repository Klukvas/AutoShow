export const LOCALES = ['uk', 'ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'uk';

/** Cookie read by `src/i18n/request.ts`. No locale prefix in the URL. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const LOCALE_SHORT: Record<Locale, string> = {
  uk: 'UA',
  ru: 'RU',
  en: 'EN',
};

/** Endonym — the name of each language in that language. */
export const LOCALE_LABEL: Record<Locale, string> = {
  uk: 'Українська',
  ru: 'Русский',
  en: 'English',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
