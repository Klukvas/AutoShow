import type { Branding } from '@/lib/api/types';
import { dayLabel } from '@/lib/working-hours';

/** `tel:` link for a phone typed for people: keeps only the digits and the leading plus. */
export function phoneHref(phone: string | null | undefined): string | null {
  return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
}

/** Google Maps search for the showroom address; a showroom without an address has no link. */
export function mapSearchHref(address: string | null | undefined): string | null {
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
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
