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
}: {
  branding: Branding | null;
  /** false on sold listings — the lead form is not rendered there. */
  acceptsLeads?: boolean;
}) {
  const t = useTranslations('listing');
  const phone = branding?.contactPhone;
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
            <span aria-hidden>📞</span>
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
