/**
 * Compact admin timestamps (handoff 1f/1i): today → "14:32", yesterday →
 * "Вчора", older → localized date. Pure so it's unit-testable; the labels
 * come from i18n at the call site.
 */

export interface RelativeDateLabels {
  today: string;
  yesterday: string;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRelativeDay(
  iso: string,
  labels: RelativeDateLabels,
  locale: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  if (sameDay(date, now)) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return labels.yesterday;

  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Longer form for detail views: "Сьогодні, 14:32 · …" */
export function formatRelativeDateTime(
  iso: string,
  labels: RelativeDateLabels,
  locale: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (sameDay(date, now)) return `${labels.today}, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `${labels.yesterday}, ${time}`;

  return `${date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}, ${time}`;
}
