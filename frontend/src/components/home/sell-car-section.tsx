import { getTranslations } from 'next-intl/server';
import { SellCarForm } from '@/components/lead/sell-car-form';

/**
 * Consignment funnel: the showroom's second lead source — owners bringing
 * their cars to sell. Copy sells the service, the form captures the car.
 */
export async function SellCarSection() {
  const t = await getTranslations('sell');
  const steps = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
  ];

  return (
    <section id="sell" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:px-8 md:py-16">
        <div>
          <p className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
            {t('eyebrow')}
          </p>
          <h2 className="mt-2 font-heading text-title-lg font-extrabold text-ink">{t('title')}</h2>
          <p className="mt-3 max-w-[440px] text-body-md leading-relaxed text-ink-2">{t('subtitle')}</p>
          <ol className="mt-6 space-y-4">
            {steps.map((step, idx) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-[13.5px] font-extrabold text-on-accent">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="text-body-md font-bold text-ink">{step.title}</h3>
                  <p className="mt-0.5 text-sub text-ink-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-card border border-line bg-bg p-6">
          <h3 className="font-heading text-section font-bold text-ink">{t('formTitle')}</h3>
          <p className="mb-5 mt-1 text-sub text-ink-2">{t('formSubtitle')}</p>
          <SellCarForm />
        </div>
      </div>
    </section>
  );
}
