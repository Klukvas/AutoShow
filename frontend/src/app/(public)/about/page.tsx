import { getTranslations } from 'next-intl/server';
import { getSiteBranding } from '@/lib/branding/resolve';
import { hoursLines } from '@/lib/working-hours';

export const revalidate = 300;

export default async function AboutPage() {
  const [t, branding] = await Promise.all([getTranslations('about'), getSiteBranding()]);
  const hours = hoursLines(branding?.workingHours);

  return (
    <>
      <section className="border-b border-line bg-surface-warm">
        <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8 md:py-20">
          <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t('title')}
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-hero font-extrabold text-ink md:text-editorial md:font-black">
            {branding?.tagline ?? t('intro')}
          </h1>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-5 py-12 md:grid-cols-2 md:px-8 md:py-16">
        <p className="max-w-[560px] text-[17px] leading-[1.75] text-ink-2">{t('intro')}</p>
        <div className="space-y-8">
          {branding?.address && (
            <div>
              <h2 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
                {t('showroom')}
              </h2>
              <p className="mt-3 font-heading text-section font-bold text-ink">
                {branding.address}
              </p>
            </div>
          )}
          {hours.length > 0 && (
            <div>
              <h2 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
                {t('hours')}
              </h2>
              <div className="mt-3 space-y-1">
                {hours.map((line) => (
                  <p key={line} className="tabular text-body-md text-ink-2">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
