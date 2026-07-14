/**
 * Working-hours form model: the backend stores a free-form record (possibly
 * ranged keys like `mon_fri`); the editor always presents 7 explicit days.
 * Ranged keys are expanded into the days they cover on load; the form saves
 * back per-day keys (the storefront's hoursLines() renders either shape).
 */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export type HourSlot = { open: string; close: string } | null;
export type HoursRecord = Record<string, HourSlot> | null | undefined;
export type DayHours = Record<Day, HourSlot>;

const RANGE_KEYS: Record<string, Day[]> = {
  mon_fri: ['mon', 'tue', 'wed', 'thu', 'fri'],
  mon_sat: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  mon_sun: [...DAYS],
  weekend: ['sat', 'sun'],
};

export function expandHours(record: HoursRecord): DayHours {
  const result = Object.fromEntries(DAYS.map((d) => [d, null])) as DayHours;
  for (const [key, slot] of Object.entries(record ?? {})) {
    const normalizedKey = key.toLowerCase();
    const days = RANGE_KEYS[normalizedKey] ?? (DAYS.includes(normalizedKey as Day) ? [normalizedKey as Day] : []);
    for (const day of days) {
      result[day] = slot && slot.open && slot.close ? { open: slot.open, close: slot.close } : null;
    }
  }
  return result;
}

/** Drop-all-null → null so an untouched empty schedule stays "not configured". */
export function compactHours(hours: DayHours): Record<string, HourSlot> | null {
  const hasAny = DAYS.some((d) => hours[d] !== null);
  return hasAny ? { ...hours } : null;
}
