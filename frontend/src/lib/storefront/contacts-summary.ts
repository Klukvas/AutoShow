import type { Branding } from '@/lib/api/types';
import { dayLabel } from '@/lib/working-hours';

/** `tel:` link for a phone typed for people: keeps only the digits and the leading plus. */
export function phoneHref(phone: string | null | undefined): string | null {
  return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
}

function mapQuery(address: string | null | undefined): string | null {
  const query = address?.replace(/[\u0000-\u001f]/g, ' ').trim();
  return query ? query : null;
}

/** Google Maps search for the showroom address; a showroom without an address has no link. */
export function mapSearchHref(address: string | null | undefined): string | null {
  const query = mapQuery(address);
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

/**
 * Embedded map for the same address. Google places the pin from the query,
 * so the showroom does not need coordinates. No address, no frame.
 */
export function mapEmbedSrc(address: string | null | undefined, locale?: string): string | null {
  const query = mapQuery(address);
  if (!query) return null;
  const hl = locale === 'ru' || locale === 'en' ? locale : 'uk';
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=${hl}&z=16&output=embed`;
}

export type ScheduleLine = Readonly<{ day: string; label: string; hours: string }>;

/**
 * Every configured day in the order the showroom saved it. Unlike the compact
 * `hoursLines`, days off stay in the list and say so, because this is the full table.
 */
export function weeklySchedule(
  workingHours: Branding['workingHours'] | undefined,
  closedLabel: string,
): readonly ScheduleLine[] {
  return Object.entries(workingHours ?? {}).map(([day, slot]) => ({
    day,
    label: dayLabel(day),
    hours: slot ? `${slot.open} — ${slot.close}` : closedLabel,
  }));
}
