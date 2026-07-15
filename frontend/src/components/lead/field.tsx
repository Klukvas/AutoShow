'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface LeadFieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  as?: 'input' | 'textarea';
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  defaultValue?: string;
}

/** Labelled input with inline error — shared by all public lead forms. */
export function LeadField({
  name,
  label,
  type = 'text',
  required,
  as = 'input',
  error,
  autoComplete,
  placeholder,
  inputMode,
  defaultValue,
}: LeadFieldProps) {
  // useId keeps error ids unique even if two form instances ever share a DOM.
  const uid = useId();
  const errorId = error ? `${uid}-error` : undefined;
  const base = cn(
    'focus-ring block w-full rounded-input border bg-surface px-3.5 text-body-md text-ink outline-none transition-colors placeholder:text-ink-3',
    error ? 'border-danger' : 'border-line-input focus:border-ink-3',
  );
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-label font-semibold uppercase text-ink-2">
          {label}
          {required && (
            <span aria-hidden className="text-danger">
              {' '}
              *
            </span>
          )}
        </span>
        {as === 'textarea' ? (
          <textarea
            name={name}
            rows={3}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            defaultValue={defaultValue}
            className={cn(base, 'resize-none py-2.5')}
          />
        ) : (
          <input
            name={name}
            type={type}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            autoComplete={autoComplete}
            placeholder={placeholder}
            inputMode={inputMode}
            defaultValue={defaultValue}
            className={cn(base, 'h-11')}
          />
        )}
      </label>
      {error && (
        <p id={errorId} className="mt-1 text-sub font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Honeypot input — bots fill it, the backend silently drops the lead. */
export function HoneypotField({ id }: { id: string }) {
  return (
    <div role="presentation" aria-hidden="true" className="pointer-events-none">
      <label className="sr-only" htmlFor={id}>
        Leave this field empty
      </label>
      <input
        id={id}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
    </div>
  );
}
