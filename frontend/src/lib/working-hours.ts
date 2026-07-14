// Human labels for working-hours keys (the backend stores machine keys like
// `mon_fri`). Unknown keys fall back to a de-underscored version of the key.
export const DAY_LABELS: Record<string, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Нд',
  mon_fri: 'Пн–Пт',
  mon_sat: 'Пн–Сб',
  weekend: 'Сб–Нд',
};

export function dayLabel(key: string): string {
  return DAY_LABELS[key.toLowerCase()] ?? key.replace(/_/g, ' ');
}

type WorkingHours = Record<string, { open: string; close: string } | null> | null | undefined;

/**
 * Compact "Пн–Пт · 9:00–20:00" lines for the contact panel — one line per
 * open slot group, closed days skipped (the full table lives in the footer).
 */
export function hoursLines(hours: WorkingHours): string[] {
  return Object.entries(hours ?? {})
    .filter(
      // Guard partial backend data too — a slot missing open/close would
      // otherwise render as the string "null".
      (entry): entry is [string, { open: string; close: string }] =>
        entry[1] != null && typeof entry[1].open === 'string' && typeof entry[1].close === 'string',
    )
    .map(([day, slot]) => `${dayLabel(day)} · ${slot.open}–${slot.close}`);
}
