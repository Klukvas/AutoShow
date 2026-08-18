import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Eyebrow } from '@/components/ui/eyebrow';
import { dayLabel } from '@/lib/working-hours';
import type { Branding } from '@/lib/api/types';

interface PublicFooterProps {
  branding: Branding | null;
}

const NAV_LINKS = [
  { href: '/cars', key: 'catalog' },
  { href: '/about', key: 'about' },
  { href: '/contacts', key: 'contacts' },
] as const;

/**
 * Storefront footer as an editorial colophon: mono column labels, an oversize
 * contact block, navigation + working hours, closed by a colophon row that
 * sets the typefaces in type. Follows the Paper Lot palette in both themes.
 */
export async function PublicFooter({ branding }: PublicFooterProps) {
  const t = await getTranslations('footer');
  const display = branding?.displayName ?? 'AutoFlow';
  return (
    <footer className="border-t border-line bg-surface text-ink">
      <div className="mx-auto grid grid-cols-1 gap-12 px-5 py-14 md:grid-cols-12 md:px-8">
        <div className="md:col-span-6">
          <Eyebrow as="div">{t('contactTitle')}</Eyebrow>
          <div className="mt-4 space-y-1 font-heading text-title-sm font-bold tracking-tight">
            {branding?.contactPhone && (
              <div>
                <a
                  href={`tel:${branding.contactPhone.replace(/[^+\d]/g, '')}`}
                  className="focus-ring tabular transition-colors hover:text-lot-gold"
                >
                  {branding.contactPhone}
                </a>
              </div>
            )}
            {branding?.contactEmail && (
              <div>
                <a
                  href={`mailto:${branding.contactEmail}`}
                  className="focus-ring transition-colors hover:text-lot-gold"
                >
                  {branding.contactEmail}
                </a>
              </div>
            )}
          </div>
          {branding?.address && <p className="mt-4 text-body-md text-ink-2">{branding.address}</p>}
        </div>

        <div className="md:col-span-3">
          <Eyebrow as="div">{t('navTitle')}</Eyebrow>
          <ul className="mt-4 space-y-2.5 text-body-md">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  className="focus-ring text-ink-2 transition-colors hover:text-ink"
                  href={link.href}
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <Eyebrow as="div">{t('hoursTitle')}</Eyebrow>
          <ul className="mt-4 space-y-2 text-body-md text-ink-2">
            {Object.entries(branding?.workingHours ?? {}).map(([day, slot]) => (
              <li key={day} className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="font-medium text-ink">{dayLabel(day)}</span>
                <span className="tabular">
                  {slot ? `${slot.open} — ${slot.close}` : t('closed')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Colophon — set in type */}
      <div className="border-t border-line">
        <div className="mx-auto flex flex-col items-start justify-between gap-3 px-5 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-3 md:flex-row md:items-center md:px-8">
          <span className="tabular">
            © {new Date().getFullYear()} {display}
          </span>
          <span aria-hidden className="hidden text-ink-3/80 sm:block">
            Onest · Schibsted Grotesk
          </span>
          {branding?.socialLinks?.instagram && (
            <a
              href={branding.socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring transition-colors hover:text-lot-gold"
            >
              Instagram
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
