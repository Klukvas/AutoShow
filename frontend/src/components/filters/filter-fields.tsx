'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow } from '@/components/ui/eyebrow';

export interface SelectOption {
  label: string;
  value: string;
}

/**
 * URL-bound text field with debounce. Owns its own draft so typing is smooth;
 * commits to the URL 400ms after the last keystroke (or on Enter). Reflects
 * external URL changes (reset / chip removal / back-forward) only while the
 * field is NOT focused, so it never clobbers what the user is typing.
 */
export function SearchField({
  paramKey,
  value,
  placeholder,
  clearLabel,
  onCommit,
  className,
  icon = true,
}: {
  paramKey: string;
  value: string;
  placeholder: string;
  clearLabel: string;
  onCommit: (next: string | undefined) => void;
  className?: string;
  icon?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    onCommit(next.trim() || undefined);
  };
  const onType = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next.trim() || undefined), 400);
  };

  return (
    <div
      className={cn(
        'flex h-[42px] items-center rounded-input border border-line-input bg-surface transition-colors focus-within:border-ink-3',
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="pl-3 text-ink-3">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.5 9.5 12.5 12.5" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <input
        type={icon ? 'search' : 'text'}
        name={paramKey}
        value={draft}
        placeholder={placeholder}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
        }}
        className="w-full bg-transparent px-3 text-sub text-ink outline-none placeholder:text-ink-3"
      />
      {draft && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            setDraft('');
            commit('');
          }}
          className="focus-ring flex h-full w-9 items-center justify-center rounded-input text-ink-3 hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Vertical labelled select (40px) — used both in the desktop rail and in the
 * mobile sheet. Value set → ink text; empty ("any") → tertiary placeholder.
 */
export function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
  hideLabel,
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  placeholder: string;
  onChange: (next: string | undefined) => void;
  disabled?: boolean;
  /** Keep the label for screen readers only (compact rows with a shared heading). */
  hideLabel?: boolean;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <Eyebrow className={hideLabel ? 'sr-only' : 'mb-1.5 block'}>{label}</Eyebrow>
      <span className="relative block">
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          'platform-select focus-ring h-10 w-full appearance-none rounded-btn border border-line-input bg-surface px-3 pr-8 text-sub transition-colors',

          value ? 'text-ink' : 'text-ink-3',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
        <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m1 1 5 5 5-5" />
        </svg>
      </span>
    </label>
  );
}

/** Labelled from/to numeric pair (price, year) or a single bound (mileage). */
export function RangeField({
  label,
  fromValue,
  toValue,
  fromPlaceholder,
  toPlaceholder,
  onFromChange,
  onToChange,
}: {
  label: string;
  fromValue: string | undefined;
  toValue?: string | undefined;
  fromPlaceholder: string;
  toPlaceholder?: string;
  onFromChange: (next: string | undefined) => void;
  onToChange?: (next: string | undefined) => void;
}) {
  return (
    <div>
      <Eyebrow className="mb-1.5 block">{label}</Eyebrow>
      <div className="flex items-center gap-2">
        <RangeInput value={fromValue} placeholder={fromPlaceholder} onChange={onFromChange} />
        {onToChange && (
          <RangeInput value={toValue} placeholder={toPlaceholder ?? ''} onChange={onToChange} />
        )}
      </div>
    </div>
  );
}

export function RangeInput({
  value,
  placeholder,
  onChange,
  ariaLabel,
}: {
  value: string | undefined;
  placeholder: string;
  onChange: (next: string | undefined) => void;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? '');
  }, [value]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  // A live timer means "draft not yet committed" — the debounce callback clears
  // it, so blur/Enter only commit when there is actually uncommitted input
  // (prevents a duplicate URL push right after the timer has fired).
  const commitPending = (next: string) => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    onChange(next || undefined);
  };

  const onType = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      onChange(next || undefined);
    }, 500);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commitPending(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitPending(draft);
      }}
      onChange={(e) => onType(e.target.value)}
      className="focus-ring tabular h-10 w-full min-w-0 rounded-btn border border-line-input bg-surface px-3 text-sub text-ink outline-none transition-colors placeholder:text-ink-3 focus-within:border-ink-3"
    />
  );
}

/**
 * Checkbox dropdown for picking several values (models within a make).
 * Each toggle commits immediately, like the option pills. Escape is marked
 * handled so the surrounding mobile sheet stays open.
 */
export function MultiSelectField({
  label,
  values,
  options,
  placeholder,
  onChange,
  disabled,
  maxSelected,
}: {
  label: string;
  values: string[];
  options: SelectOption[];
  placeholder: string;
  onChange: (next: string[]) => void;
  disabled?: boolean;
  maxSelected?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A field disabled while open (make changed by keyboard) renders no list.
    if (!open || disabled) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    // Capture phase: runs before the sheet's own document listener, so it
    // sees the Escape as handled regardless of registration order.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, disabled]);

  const summary = values
    .map((value) => options.find((o) => o.value === value)?.label ?? value)
    .join(', ');
  const isFull = maxSelected != null && values.length >= maxSelected;
  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={summary ? `${label}: ${summary}` : label}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          'focus-ring flex h-10 w-full items-center rounded-btn border border-line-input bg-surface px-3 pr-8 text-left text-sub transition-colors',
          summary ? 'text-ink' : 'text-ink-3',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="truncate">{summary || placeholder}</span>
      </button>
      <svg
        aria-hidden
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-3 top-5 h-2 w-3 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="m1 1 5 5 5-5" />
      </svg>
      {open && !disabled && (
        <div
          role="group"
          aria-label={label}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-btn border border-line bg-surface p-1 shadow-lg"
        >
          {options.map((option) => {
            const checked = values.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-btn px-2.5 py-2 text-sub text-ink hover:bg-bg',
                  !checked && isFull && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && isFull}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
