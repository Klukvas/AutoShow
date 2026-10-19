'use client';

import { cn } from '@/lib/cn';

/** Custom event carrying the picked placement package id to the sell form. */
export const PACKAGE_PICK_EVENT = 'af:placement-package';
/** DOM id of the sell section the pick scrolls to. */
export const SELL_SECTION_ID = 'sell';

/**
 * "Обрати" on a tariff card: preselects the package in the sell form and
 * scrolls there — no URL churn, so the cached homepage stays static. Without
 * JS it degrades to a plain #sell anchor.
 */
export function PackagePickLink({
  packageId,
  label,
  ariaLabel,
  className,
}: {
  packageId: string;
  label: string;
  ariaLabel: string;
  className?: string;
}) {
  const pick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<string>(PACKAGE_PICK_EVENT, { detail: packageId }));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(SELL_SECTION_ID)?.scrollIntoView({
      behavior: reduce ? 'instant' : 'smooth',
      block: 'start',
    });
  };

  return (
    <a
      href={`#${SELL_SECTION_ID}`}
      onClick={pick}
      aria-label={ariaLabel}
      className={cn('home-package-cta focus-ring', className)}
    >
      {label} <span aria-hidden>→</span>
    </a>
  );
}
