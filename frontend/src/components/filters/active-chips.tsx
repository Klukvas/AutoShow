'use client';

export interface ActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

/** Removable accent-soft pill for one applied filter. */
export function ActiveChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  /** Accessible action prefix, e.g. "Прибрати фільтр" — "✕" reads poorly in SRs. */
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-chip border border-accent/25 bg-accent/[0.08] pl-3 pr-1 text-sub font-medium text-accent-hover dark:bg-accent/[0.14] dark:text-accent">
      {label}
      <button
        type="button"
        aria-label={`${removeLabel}: ${label}`}
        onClick={onRemove}
        className="focus-ring flex h-6 w-6 items-center justify-center rounded-chip text-accent-hover/70 hover:text-accent-hover dark:text-accent/70 dark:hover:text-accent"
      >
        <span aria-hidden>✕</span>
      </button>
    </span>
  );
}

/**
 * Row of applied-filter chips + "reset all". Desktop wraps; on mobile the
 * parent constrains it to a horizontal scroller per handoff 1b.
 */
export function ActiveChipsRow({
  filters,
  resetLabel,
  removeLabel,
  onResetAll,
  scrollable,
}: {
  filters: ActiveFilter[];
  resetLabel: string;
  removeLabel: string;
  onResetAll: () => void;
  scrollable?: boolean;
}) {
  if (filters.length === 0) return null;
  return (
    <div
      className={
        scrollable
          ? 'flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      {filters.map((f) => (
        <ActiveChip key={f.id} label={f.label} removeLabel={removeLabel} onRemove={f.onRemove} />
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="focus-ring shrink-0 rounded-chip px-2 py-1 text-sub font-semibold text-accent-hover hover:underline dark:text-accent"
      >
        {resetLabel}
      </button>
    </div>
  );
}
