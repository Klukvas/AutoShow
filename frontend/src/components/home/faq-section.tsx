import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const FAQ = [
  'documents',
  'credit',
  'tradein',
  'testdrive',
  'warranty',
  'delivery',
  'inspection',
] as const;

/** Shared questions for every showroom. Copy lives in messages until the admin can edit it. */
export async function FaqSection() {
  const t = await getTranslations('home');

  return (
    <section className="home-container home-section">
      <ScrollReveal>
        <HomeSectionHeading title={t('faqTitle')} />
      </ScrollReveal>
      <div className="home-faq-list">
        {FAQ.map((key) => (
          <details key={key} className="home-faq-item">
            <summary>{t(`faq.${key}.q`)}</summary>
            <p>{t(`faq.${key}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
