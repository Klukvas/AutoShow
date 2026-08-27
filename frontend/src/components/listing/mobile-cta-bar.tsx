import { useTranslations } from 'next-intl';
import { LeadCtaButton } from '@/components/lead/lead-cta';
import type { Branding } from '@/lib/api/types';

/**
 * Sticky bottom CTA bar (handoff 1g, mobile only): 52px call icon-button +
 * full-width "Залишити заявку". Sits above the safe area with the handoff's
 * upward shadow.
 */
export function MobileCtaBar({
  branding,
  acceptsLeads = true,
  phoneOverride,
}: {
  branding: Branding | null;
  /** false on sold listings — the lead form is not rendered there. */
  acceptsLeads?: boolean;
  /** Client (consignment) cars: the owner's phone instead of the showroom's. */
  phoneOverride?: string | null;
}) {
  const t = useTranslations('listing');
  const phone = phoneOverride ?? branding?.contactPhone;
  const phoneHref = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  if (!phoneHref && !acceptsLeads) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-cta-sticky md:hidden">
      <div className="flex items-center gap-2.5">
        {phoneHref && (
          <a
            href={phoneHref}
            aria-label={t('callCta')}
            className={
              acceptsLeads
                ? 'focus-ring flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-input border-[1.5px] border-ink bg-surface text-xl'
                : 'focus-ring flex h-[52px] flex-1 items-center justify-center gap-2 rounded-input border-[1.5px] border-ink bg-surface text-[15px] font-semibold'
            }
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2z" />
            </svg>
            {!acceptsLeads && t('callCta')}
          </a>
        )}
        {acceptsLeads && (
          <LeadCtaButton type="callback" variant="primary" className="h-[52px] flex-1">
            {t('messageCta')}
          </LeadCtaButton>
        )}
      </div>
    </div>
  );
}
