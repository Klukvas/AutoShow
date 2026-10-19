import { getTranslations } from 'next-intl/server';
import { SELL_FORM_ID } from '@/components/home/package-pick';
import { SellCarForm } from '@/components/lead/sell-car-form';
import type { PublicPlacementPackage } from '@/lib/api/types';

/**
 * Consignment funnel: the showroom's second lead source — owners bringing
 * their cars to sell. Copy sells the service, the form captures the car.
 */
export async function SellCarSection({ packages }: { packages: PublicPlacementPackage[] }) {
  const t = await getTranslations('sell');
  const steps = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
  ];

  return (
    <section id="sell" className="home-sell">
      <div className="home-container home-section home-sell-grid">
        <div>
          <p className="home-kicker">{t('eyebrow')}</p>
          <h2 className="home-sell-title">
            {t('title')}
          </h2>
          <p className="mt-3 max-w-[440px] text-body-md leading-relaxed text-ink-2">
            {t('subtitle')}
          </p>
          <ol className="mt-6 space-y-4">
            {steps.map((step, idx) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="home-step-number">
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
        <div id={SELL_FORM_ID} className="home-sell-form">
          <h3 className="font-heading text-section font-bold text-ink">{t('formTitle')}</h3>
          <p className="mb-5 mt-1 text-sub text-ink-2">{t('formSubtitle')}</p>
          <SellCarForm packages={packages} />
        </div>
      </div>
    </section>
  );
}
