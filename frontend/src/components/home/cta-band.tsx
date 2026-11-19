import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { phoneHref } from '@/lib/storefront/contacts-summary';
import { storefrontHttpUrl } from '@/lib/storefront/http-url';

/**
 * Full-bleed showroom invitation between the collections and the trust block.
 * The phone comes from installation contacts. Telegram is omitted when the
 * installation has no public http(s) link.
 */
export async function CtaBand({
  phone,
  telegram,
}: {
  phone: string | null;
  telegram: string | null;
}) {
  const t = await getTranslations('home');
  const tel = phoneHref(phone);
  const telegramHref = storefrontHttpUrl(telegram);

  return (
    <section className="home-cta-band" aria-labelledby="home-cta-title">
      <Image src="/demo/cta-band.jpg" alt="" fill sizes="100vw" className="home-cta-band-photo" />
      <div className="home-cta-band-shade" aria-hidden />
      <div className="home-cta-band-content home-container">
        <ScrollReveal>
          <h2 id="home-cta-title">{t('ctaTitle')}</h2>
        </ScrollReveal>
        {(tel || telegramHref) && (
          <ScrollReveal>
            <div className="home-cta-band-actions">
              {tel && (
                <a className="home-primary-cta focus-ring" href={tel}>
                  {t('ctaCall')}
                </a>
              )}
              {telegramHref && (
                <a
                  className="home-cta-band-telegram focus-ring"
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('ctaTelegram')}
                </a>
              )}
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
