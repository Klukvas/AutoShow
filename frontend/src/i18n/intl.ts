import { resolveLocale, type Locale } from './locales';

/** BCP-47 tags for `Intl` date and number formatting. */
const INTL_LOCALE: Record<Locale, string> = {
  uk: 'uk-UA',
  ru: 'ru-RU',
  en: 'en-GB',
};

export function intlLocale(locale: string | null | undefined): string {
  return INTL_LOCALE[resolveLocale(locale)];
}
