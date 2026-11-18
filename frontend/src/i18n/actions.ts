'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, type Locale } from './locales';

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Persist the visitor's language. The next render reads `LOCALE_COOKIE`. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: YEAR_SECONDS,
    sameSite: 'lax',
  });
}
