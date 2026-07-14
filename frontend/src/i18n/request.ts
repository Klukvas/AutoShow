import { getRequestConfig } from 'next-intl/server';

const LOCALES = ['uk'] as const;
type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const locale: Locale = 'uk';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
