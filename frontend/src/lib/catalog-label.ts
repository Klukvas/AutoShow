import { resolveLocale } from '@/i18n/locales';

/** English uses `nameEn` when the directory has one. Russian has no separate name. */
export function catalogLabel(
  ref: { nameUk: string; nameEn?: string | null } | null | undefined,
  locale?: string | null,
): string {
  if (!ref) return '';
  if (resolveLocale(locale) === 'en') {
    const english = ref.nameEn?.trim();
    if (english) return english;
  }
  return ref.nameUk;
}
