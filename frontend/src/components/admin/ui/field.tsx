import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Admin form primitives per the handoff: 12/600 labels, 42px inputs with
 * 9px radius, error state = 1.5px --danger border on --danger-bg + message
 * linked via aria-describedby. All controls carry the teal focus ring.
 */

export const inputCls = (invalid?: boolean) =>
  cn(
    'h-[42px] w-full rounded-[9px] border bg-surface px-3 text-[13.5px] font-semibold text-ink',
    'placeholder:font-medium placeholder:text-ink-3 outline-none focus-ring transition-none',
    invalid ? 'border-[1.5px] border-danger bg-danger-bg' : 'border-line-input',
  );

interface FieldShellProps {
  label: React.ReactNode;
  required?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => React.ReactNode;
}

/** Label + control + error wiring; the control is render-prop injected. */
export function FieldShell({ label, required, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-[5px] block text-[12px] font-semibold text-ink-2">
        {label}
        {required && (
          <span aria-hidden className="text-ink-2">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-[5px] text-[11.5px] font-medium text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-[5px] text-[11.5px] font-medium text-danger">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

type NativeInput = React.InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  label,
  error,
  hint,
  className,
  required,
  ...rest
}: {
  label: React.ReactNode;
  error?: string | null;
  hint?: string;
  className?: string;
} & NativeInput) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={inputCls(Boolean(error))}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  required,
  children,
  ...rest
}: {
  label: React.ReactNode;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(inputCls(Boolean(error)), 'appearance-none pr-8', SELECT_ARROW)}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/* Chevron drawn as a background so the native arrow can be replaced
   consistently across platforms; currentColor is not available in CSS url(),
   so the glyph uses the neutral #B7BAC2 from the handoff (both themes read it
   as "muted control affordance"). NOTE: the data-URI is fully %-encoded —
   a literal space inside an arbitrary value breaks Tailwind's class parser. */
const SELECT_ARROW =
  "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%226%22%20viewBox=%220%200%2010%206%22%3E%3Cpath%20d=%22M1%201l4%204%204-4%22%20stroke=%22%23B7BAC2%22%20stroke-width=%221.6%22%20fill=%22none%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E')] bg-[position:right_12px_center] bg-no-repeat";

export function TextareaField({
  label,
  error,
  hint,
  className,
  required,
  ...rest
}: {
  label: React.ReactNode;
  error?: string | null;
  hint?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            inputCls(Boolean(error)),
            'h-auto min-h-[96px] py-[10px] text-[13.5px] font-normal leading-relaxed',
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/** Handoff checkbox: 18px square, 5px radius, accent fill when checked. */
export function CheckboxField({
  label,
  className,
  ...rest
}: { label: React.ReactNode; className?: string } & NativeInput) {
  return (
    <label
      className={cn(
        'inline-flex min-h-[44px] cursor-pointer items-center gap-2 py-2 text-[13px] font-medium text-ink',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" {...rest} />
        <span
          aria-hidden
          className={cn(
            'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] border-line-input bg-surface',
            'peer-checked:border-accent peer-checked:bg-accent',
            'peer-focus-visible:shadow-[0_0_0_2px_rgb(var(--bg)),0_0_0_4px_rgb(var(--focus))]',
          )}
        >
          {/* svg is a DESCENDANT of the peer's sibling, so `peer-checked:`
              can't reach it — the arbitrary selector below does. */}
          <svg
            viewBox="0 0 12 10"
            className="h-[10px] w-[10px] text-on-accent opacity-0 [.peer:checked~span_&]:opacity-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 5.4 4.2 8.6 11 1.4" />
          </svg>
        </span>
      </span>
      <span>{label}</span>
    </label>
  );
}

/** Handoff switch: 34×20 pill, 16px knob, accent when on. */
export function ToggleField({
  label,
  className,
  ...rest
}: { label: React.ReactNode; className?: string } & NativeInput) {
  return (
    <label
      className={cn(
        'inline-flex min-h-[44px] cursor-pointer items-center gap-2 py-2 text-[13px] font-medium text-ink',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input type="checkbox" role="switch" className="peer sr-only" {...rest} />
        <span
          aria-hidden
          className={cn(
            'block h-5 w-[34px] rounded-full bg-line-input transition-colors',
            'peer-checked:bg-accent',
            'peer-focus-visible:shadow-[0_0_0_2px_rgb(var(--bg)),0_0_0_4px_rgb(var(--focus))]',
            'after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-surface after:transition-transform',
            'peer-checked:after:translate-x-[14px]',
          )}
        />
      </span>
      <span>{label}</span>
    </label>
  );
}

/** Option chip (multiselect) — accent-soft when selected. */
export function ChipCheckbox({
  label,
  className,
  ...rest
}: { label: React.ReactNode; className?: string } & NativeInput) {
  return (
    <label className={cn('inline-flex cursor-pointer', className)}>
      <input type="checkbox" className="peer sr-only" {...rest} />
      <span
        className={cn(
          'inline-flex min-h-[38px] items-center gap-1 rounded-[8px] border border-line-input bg-surface px-[13px] py-2 text-[13px] font-semibold text-ink-2 transition-colors',
          'peer-checked:border-accent peer-checked:bg-accent/[0.08] peer-checked:text-accent-hover',
          'peer-focus-visible:shadow-[0_0_0_2px_rgb(var(--bg)),0_0_0_4px_rgb(var(--focus))]',
        )}
      >
        {label}
      </span>
    </label>
  );
}
