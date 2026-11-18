import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, resolveLocale } from './locales';

const catalogs = {
  uk: () => import('../../messages/uk.json'),
  ru: () => import('../../messages/ru.json'),
  en: () => import('../../messages/en.json'),
};

export default getRequestConfig(async () => {
  const jar = await cookies();
  const locale = resolveLocale(jar.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: (await catalogs[locale]()).default,
  };
});
