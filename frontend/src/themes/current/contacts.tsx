import { LeadForm } from '@/components/lead/lead-form';
import { ShowroomMap } from '@/components/home/showroom-map';
import { Eyebrow } from '@/components/ui/eyebrow';
import type { ContactsProps } from '../contract';

/** Existing contacts markup: showroom contacts and opening hours beside the callback form. */
export function Contacts({ model }: ContactsProps) {
  const { t, branding, phone, phoneHref, mapHref, mapSrc, telegram, viber, schedule } = model;
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-8 md:py-14">
      <h1 className="font-heading text-title-lg font-medium text-ink">{t('title')}</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="space-y-8 md:col-span-6">
          <div>
            <Eyebrow as="h2">{t('showroom')}</Eyebrow>
            <div className="mt-3 space-y-1.5">
              {phone && phoneHref && (
                <div>
                  <a
                    href={phoneHref}
                    className="focus-ring tabular font-heading text-title-sm font-medium text-ink transition-colors hover:text-lot-gold"
                  >
                    {phone}
                  </a>
                </div>
              )}
              {branding?.contactEmail && (
                <div>
                  <a
                    href={`mailto:${branding.contactEmail}`}
                    className="focus-ring font-heading text-section font-medium text-ink transition-colors hover:text-lot-gold"
                  >
                    {branding.contactEmail}
                  </a>
                </div>
              )}
              {branding?.address && <p className="text-body-md text-ink-2">{branding.address}</p>}
              {(telegram || viber) && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {telegram && (
                    <a
                      href={telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex min-h-11 items-center border border-line-strong px-4 text-sub font-medium text-ink hover:border-lot-gold hover:text-lot-gold"
                    >
                      {t('telegram')}
                    </a>
                  )}
                  {viber && (
                    <a
                      href={viber}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex min-h-11 items-center border border-line-strong px-4 text-sub font-medium text-ink hover:border-lot-gold hover:text-lot-gold"
                    >
                      {t('viber')}
                    </a>
                  )}
                </div>
              )}
              {mapSrc && (
                <div className="pt-4">
                  <ShowroomMap src={mapSrc} title={t('mapTitle')} />
                </div>
              )}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex items-center gap-1.5 pt-1 text-sub font-medium text-accent-hover hover:underline dark:text-accent"
                >
                  {t('mapCta')}
                </a>
              )}
            </div>
          </div>

          {schedule.length > 0 && (
            <div>
              <Eyebrow as="h2">{t('hoursTitle')}</Eyebrow>
              <ul className="mt-3 max-w-sm space-y-2">
                {schedule.map((line) => (
                  <li
                    key={line.day}
                    className="flex justify-between gap-4 border-b border-line pb-2 text-body-md"
                  >
                    <span className="font-medium text-ink">{line.label}</span>
                    <span className="tabular text-ink-2">{line.hours}</span>
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
