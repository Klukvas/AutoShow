import { getTranslations } from 'next-intl/server';
import { LeadForm } from '@/components/lead/lead-form';
import { getSiteBranding } from '@/lib/branding/resolve';
import { dayLabel } from '@/lib/working-hours';

export const revalidate = 300;

export default async function ContactsPage() {
  const [t, branding] = await Promise.all([getTranslations('contacts'), getSiteBranding()]);
  const phone = branding?.contactPhone;
  const phoneHref = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  const mapHref = branding?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branding.address)}`
    : null;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-8 md:py-14">
      <h1 className="font-heading text-title-lg font-extrabold text-ink">{t('title')}</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="space-y-8 md:col-span-6">
          <div>
            <h2 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
              {t('showroom')}
            </h2>
            <div className="mt-3 space-y-1.5">
              {phone && phoneHref && (
                <div>
                  <a
                    href={phoneHref}
                    className="focus-ring tabular font-heading text-title-sm font-bold text-ink transition-colors hover:text-accent-hover dark:hover:text-accent"
                  >
                    {phone}
                  </a>
                </div>
              )}
              {branding?.contactEmail && (
                <div>
                  <a
                    href={`mailto:${branding.contactEmail}`}
                    className="focus-ring font-heading text-section font-bold text-ink transition-colors hover:text-accent-hover dark:hover:text-accent"
                  >
                    {branding.contactEmail}
                  </a>
                </div>
              )}
              {branding?.address && <p className="text-body-md text-ink-2">{branding.address}</p>}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex items-center gap-1.5 pt-1 text-sub font-semibold text-accent-hover hover:underline dark:text-accent"
                >
                  <span aria-hidden>📍</span>
                  {t('mapCta')}
                </a>
              )}
            </div>
          </div>

          {branding?.workingHours && Object.keys(branding.workingHours).length > 0 && (
            <div>
              <h2 className="text-label font-semibold uppercase tracking-label-wide text-ink-3">
                {t('hoursTitle')}
              </h2>
              <ul className="mt-3 max-w-sm space-y-2">
                {Object.entries(branding.workingHours).map(([day, slot]) => (
                  <li
                    key={day}
                    className="flex justify-between gap-4 border-b border-line pb-2 text-body-md"
                  >
                    <span className="font-medium text-ink">{dayLabel(day)}</span>
                    <span className="tabular text-ink-2">
                      {slot ? `${slot.open} — ${slot.close}` : t('closed')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div id="lead" className="scroll-mt-24 md:col-span-6">
          <LeadForm variant="callback" />
        </div>
      </div>
    </div>
  );
}
