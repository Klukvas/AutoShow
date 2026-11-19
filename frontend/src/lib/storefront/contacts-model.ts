import { getLocale, getTranslations } from 'next-intl/server';
import { getSiteBranding } from '@/lib/branding/resolve';
import { storefrontHttpUrl } from './http-url';
import { mapEmbedSrc, mapSearchHref, phoneHref, weeklySchedule } from './contacts-summary';

/** Fetch and derive the contacts page before selecting any presentation. */
export async function getContactsModel() {
  const [t, branding, locale] = await Promise.all([
    getTranslations('contacts'),
    getSiteBranding(),
    getLocale(),
  ]);
  const phone = branding?.contactPhone;

  return {
    t,
    branding,
    phone,
    phoneHref: phoneHref(phone),
    mapHref: mapSearchHref(branding?.address),
    mapSrc: mapEmbedSrc(branding?.address, locale),
    telegram: storefrontHttpUrl(branding?.socialLinks?.telegram),
    viber: storefrontHttpUrl(branding?.socialLinks?.viber),
    schedule: weeklySchedule(branding?.workingHours, t('closed')),
  };
}
export type ContactsModel = Awaited<ReturnType<typeof getContactsModel>>;
