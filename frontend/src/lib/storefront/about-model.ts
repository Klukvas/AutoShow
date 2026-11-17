import { getTranslations } from 'next-intl/server';
import { getSiteBranding } from '@/lib/branding/resolve';
import { hoursLines } from '@/lib/working-hours';

/** Value props — copy lives in messages/uk.json under about.principles.<key>. */
const PRINCIPLES = ['curation', 'honesty', 'consignment', 'contact'] as const;

/** Fetch and derive the "about the showroom" page before selecting any presentation. */
export async function getAboutModel() {
  const [t, branding] = await Promise.all([getTranslations('about'), getSiteBranding()]);

  return {
    t,
    branding,
    headline: branding?.tagline ?? t('intro'),
    principles: PRINCIPLES.map((key) => ({
      key,
      title: t(`principles.${key}.title`),
      body: t(`principles.${key}.body`),
    })),
    hours: hoursLines(branding?.workingHours),
  };
}
export type AboutModel = Awaited<ReturnType<typeof getAboutModel>>;
