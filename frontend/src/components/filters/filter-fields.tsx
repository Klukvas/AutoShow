'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

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
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  placeholder: string;
  onChange: (next: string | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label font-semibold uppercase text-ink-2">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          'focus-ring h-10 w-full appearance-none rounded-btn border border-line-input bg-surface px-3 pr-8 text-sub transition-colors',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%238C929E%27 stroke-width=%271.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E")] bg-[position:right_12px_center] bg-no-repeat',
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
      <span className="mb-1.5 block text-label font-semibold uppercase text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        <RangeInput value={fromValue} placeholder={fromPlaceholder} onChange={onFromChange} />
        {onToChange && (
          <RangeInput value={toValue} placeholder={toPlaceholder ?? ''} onChange={onToChange} />
        )}
      </div>
    </div>
  );
}

function RangeInput({
  value,
  placeholder,
  onChange,
}: {
  value: string | undefined;
  placeholder: string;
  onChange: (next: string | undefined) => void;
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
