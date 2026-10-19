/** Field-level error text of the last validation, or null. */
export type FieldErrorOf = (field: string) => string | null;

export const formGridCls = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3';
export const secondaryBtn =
  'focus-ring inline-flex h-10 items-center rounded-none border border-line-input bg-surface px-4 text-[0.8125rem] font-medium text-ink transition-none hover:border-line-hover disabled:opacity-50';
export const primaryBtn =
  'focus-ring inline-flex h-10 items-center rounded-none bg-accent px-[18px] text-[0.8125rem] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50';
