import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeSectionHeading } from './home-section-heading';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

/** Split “about the showroom” on the homepage. The photo is a replaceable demo file. */
export async function AboutBand() {
  const t = await getTranslations('home');
  const paragraphs = [t('aboutP1'), t('aboutP2'), t('aboutP3'), t('aboutP4')];

  return (
    <section className="home-container home-section">
      <div className="home-about">
        <ScrollReveal>
          <div className="home-about-photo">
            <Image
              src="/demo/about-showroom.jpg"
              alt=""
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </ScrollReveal>
        <div>
          <ScrollReveal>
            <HomeSectionHeading title={t('aboutTitle')} />
          </ScrollReveal>
          <ScrollReveal>
            <div className="home-about-copy">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <Link href="/about" className="home-text-link focus-ring">
                {t('aboutMore')} <span aria-hidden>↗</span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
