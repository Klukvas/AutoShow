import { getTranslations } from 'next-intl/server';
import { getSiteBranding } from '@/lib/branding/resolve';
import { mapSearchHref, phoneHref, weeklySchedule } from './contacts-summary';

/** Fetch and derive the contacts page before selecting any presentation. */
export async function getContactsModel() {
  const [t, branding] = await Promise.all([getTranslations('contacts'), getSiteBranding()]);
  const phone = branding?.contactPhone;

  return {
    t,
    branding,
    phone,
    phoneHref: phoneHref(phone),
    mapHref: mapSearchHref(branding?.address),
    schedule: weeklySchedule(branding?.workingHours, t('closed')),
  };
}
export type ContactsModel = Awaited<ReturnType<typeof getContactsModel>>;
