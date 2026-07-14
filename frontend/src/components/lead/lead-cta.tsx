'use client';

import { Button } from '@/components/ui/button';
import type { CreateLeadBody } from '@/lib/api/types';

export type LeadType = CreateLeadBody['type'];

/** Custom event carrying the requested lead type to the on-page form. */
export const LEAD_TYPE_EVENT = 'af:lead-type';
/** DOM id the CTA buttons scroll to (the lead form section). */
export const LEAD_FORM_ID = 'lead';

/**
 * Contact-panel CTA that preselects a lead type in the on-page form and
 * scrolls to it — no URL churn, works from the sticky panel and the mobile
 * bottom bar alike.
 */
export function LeadCtaButton({
  type,
  variant = 'outline',
  size = 'lg',
  className,
  children,
}: {
  type: LeadType;
  variant?: 'primary' | 'outline' | 'ghost' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}) {
  const activate = () => {
    window.dispatchEvent(new CustomEvent<LeadType>(LEAD_TYPE_EVENT, { detail: type }));
    document.getElementById(LEAD_FORM_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={activate}>
      {children}
    </Button>
  );
}
