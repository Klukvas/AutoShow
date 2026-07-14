import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
 * Storefront footer on the surface token: contact block with oversize phone /
 * email, navigation column and working hours, closed by a hairline copyright
 * row. Follows the handoff palette in both themes.
 */
export async function PublicFooter({ branding }: PublicFooterProps) {
  const t = await getTranslations('footer');
  const display = branding?.displayName ?? 'AutoFlow';
  return (
    <footer className="border-t border-line bg-surface text-ink">
      <div className="mx-auto grid grid-cols-1 gap-12 px-5 py-14 md:grid-cols-12 md:px-8">
        <div className="md:col-span-6">
          <div className="text-label font-semibold uppercase text-ink-3">{t('contactTitle')}</div>
          <div className="mt-4 space-y-1 font-heading text-title-sm font-bold tracking-tight">
            {branding?.contactPhone && (
              <div>
                <a
                  href={`tel:${branding.contactPhone.replace(/[^+\d]/g, '')}`}
                  className="focus-ring tabular transition-colors hover:text-accent-hover dark:hover:text-accent"
                >
                  {branding.contactPhone}
                </a>
              </div>
            )}
            {branding?.contactEmail && (
              <div>
                <a
                  href={`mailto:${branding.contactEmail}`}
                  className="focus-ring transition-colors hover:text-accent-hover dark:hover:text-accent"
                >
                  {branding.contactEmail}
                </a>
              </div>
            )}
          </div>
          {branding?.address && <p className="mt-4 text-body-md text-ink-2">{branding.address}</p>}
        </div>

        <div className="md:col-span-3">
          <div className="text-label font-semibold uppercase text-ink-3">{t('navTitle')}</div>
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
          <div className="text-label font-semibold uppercase text-ink-3">{t('hoursTitle')}</div>
          <ul className="mt-4 space-y-2 text-body-md text-ink-2">
            {Object.entries(branding?.workingHours ?? {}).map(([day, slot]) => (
              <li key={day} className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="font-medium text-ink">{dayLabel(day)}</span>
                <span className="tabular">{slot ? `${slot.open} — ${slot.close}` : t('closed')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex flex-col items-start justify-between gap-3 px-5 py-5 text-sub text-ink-3 md:flex-row md:items-center md:px-8">
          <span>
            © {new Date().getFullYear()} {display}
          </span>
          {branding?.socialLinks?.instagram && (
            <a
              href={branding.socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring transition-colors hover:text-ink"
            >
              Instagram
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
