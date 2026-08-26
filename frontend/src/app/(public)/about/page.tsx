import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatsBand } from '@/components/home/stats-band';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { getSiteBranding } from '@/lib/branding/resolve';
import { hoursLines } from '@/lib/working-hours';

export const revalidate = 300;

/** Value props — copy lives in messages/uk.json under about.principles.<key>. */
const PRINCIPLES = ['curation', 'honesty', 'consignment', 'contact'] as const;

export default async function AboutPage() {
  const [t, branding] = await Promise.all([getTranslations('about'), getSiteBranding()]);
  const hours = hoursLines(branding?.workingHours);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-surface-warm">
        <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8 md:py-20">
          <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t('title')}
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-hero font-extrabold text-ink md:text-editorial md:font-black">
            {branding?.tagline ?? t('intro')}
          </h1>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.7] text-ink-2">{t('lead')}</p>
        </div>
      </section>

      {/* №01 — who we are */}
      <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
        <SectionHeading index="01" title={t('whoTitle')} />
        <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-[1.2fr_1fr]">
          <p className="max-w-[620px] text-[17px] leading-[1.8] text-ink-2">{t('whoBody')}</p>
          <p className="text-body-md leading-[1.8] text-ink-3">{t('intro')}</p>
        </div>
      </section>

      {/* Live trust numbers — real counters from /stats; hidden when zero. */}
      <StatsBand />

      {/* №02 — how we work */}
      <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
        <SectionHeading index="02" title={t('howTitle')} />
        <div className="mt-6 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((key, i) => (
            <ScrollReveal key={key} delay={i * 0.06}>
              <div className="h-full rounded-card border border-line bg-surface p-5">
                <div className="font-mono text-[0.625rem] font-bold tracking-[0.18em] text-lot-gold">
                  0{i + 1}
                </div>
                <h3 className="mt-3 font-heading text-section font-bold text-ink">
                  {t(`principles.${key}.title`)}
                </h3>
                <p className="mt-2 text-body-md leading-[1.65] text-ink-2">
                  {t(`principles.${key}.body`)}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* №03 — showroom (real branding data) */}
      {(branding?.address || hours.length > 0) && (
        <section className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
          <SectionHeading index="03" title={t('showroom')} />
          <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2">
            {branding?.address && (
              <div>
                <h3 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
                  {t('addressTitle')}
                </h3>
                <p className="mt-3 font-heading text-section font-bold text-ink">
                  {branding.address}
                </p>
              </div>
            )}
            {hours.length > 0 && (
              <div>
                <h3 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
                  {t('hours')}
                </h3>
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
      )}

      {/* CTA */}
      <section className="border-t border-line bg-surface-warm">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-5 py-14 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="font-heading text-title-lg font-extrabold text-ink">{t('ctaTitle')}</h2>
            <p className="mt-2 max-w-[520px] text-body-md text-ink-2">{t('ctaBody')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button as="a" href="/cars" variant="primary" size="lg">
              {t('ctaPrimary')}
            </Button>
            <Button as="a" href="/contacts" variant="outline" size="lg">
              {t('ctaSecondary')}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
