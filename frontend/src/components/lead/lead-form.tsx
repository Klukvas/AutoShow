'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LEAD_TYPE_EVENT, type LeadType } from '@/components/lead/lead-cta';
import { cn } from '@/lib/cn';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import type { CreateLeadBody } from '@/lib/api/types';

interface LeadFormProps {
  listingId?: string;
  variant?: LeadType;
}

type Status = 'idle' | 'sending' | 'success' | 'error-rate' | 'error-generic';

interface FieldErrors {
  name?: string;
  phone?: string;
  email?: string;
}

const LEAD_TYPES: LeadType[] = ['callback', 'message', 'test_drive'];

/** Digits-only length check — accepts +38 (067) 123-45-67 style input. */
function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** utm_* params captured from the current URL at submit time. */
function collectUtm(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const entries = [...params.entries()].filter(([key]) => key.startsWith('utm_'));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Lead form per handoff: type segment (call / message / test drive), labelled
 * fields with inline errors, hidden listing/URL/UTM binding, and explicit
 * success / error / rate-limit states. The honeypot input is visually hidden
 * but present in the DOM — bots fill it and the backend silently drops the
 * lead. Submit is guarded against double-fire by the synchronous
 * status === 'sending' check (set before the request is dispatched).
 */
export function LeadForm({ listingId, variant = 'callback' }: LeadFormProps) {
  const t = useTranslations('lead');
  const [leadType, setLeadType] = useState<LeadType>(variant);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  // Capture the form element via ref — `e.target` is a synthetic React event
  // that may be nulled out by the time the async submit promise resolves.
  const formRef = useRef<HTMLFormElement>(null);

  // Contact-panel CTAs preselect the type (e.g. "Тест-драйв") via a DOM event.
  useEffect(() => {
    const onType = (event: Event) => {
      const detail = (event as CustomEvent<LeadType>).detail;
      if (LEAD_TYPES.includes(detail)) setLeadType(detail);
    };
    window.addEventListener(LEAD_TYPE_EVENT, onType);
    return () => window.removeEventListener(LEAD_TYPE_EVENT, onType);
  }, []);

  const validate = (form: FormData): FieldErrors => {
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    return {
      ...(name ? {} : { name: t('errorName') }),
      ...(isValidPhone(phone) ? {} : { phone: t('errorPhone') }),
      ...(email && !isValidEmail(email) ? { email: t('errorEmail') } : {}),
    };
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const form = new FormData(e.currentTarget);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const body: CreateLeadBody = {
      type: leadType,
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || undefined,
      message: String(form.get('message') ?? '').trim() || undefined,
      listingId,
      sourceUrl: window.location.href,
      utm: collectUtm(),
      website: String(form.get('website') ?? ''),
    };
    setStatus('sending');
    publicApi
      .submitLead(body)
      .then(() => {
        // Reset while the form is still mounted — the success branch replaces it.
        formRef.current?.reset();
        setStatus('success');
      })
      .catch((err) => {
        if (err instanceof ApiClientError && (err.status === 403 || err.status === 429)) {
          setStatus('error-rate');
        } else {
          setStatus('error-generic');
        }
      });
  };

  if (status === 'success') {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        <h2 className="font-heading text-section font-bold text-ink">{t('title')}</h2>
        <div className="mt-4 flex items-start gap-3 rounded-input bg-ok-bg p-4">
          <span aria-hidden className="text-ok">
            ✓
          </span>
          <p className="text-body-md font-medium text-ok">{t('success')}</p>
        </div>
      </div>
    );
  }

  const sending = status === 'sending';

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="rounded-card border border-line bg-surface p-6"
    >
      <h2 className="font-heading text-section font-bold text-ink">{t('title')}</h2>
      <p className="mt-1 text-body-md text-ink-2">{t('subtitle')}</p>

      {/* Lead type segment */}
      <div
        role="radiogroup"
        aria-label={t('typeLabel')}
        className="mt-5 flex flex-wrap gap-2 rounded-input bg-bg p-1"
      >
        {LEAD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={leadType === type}
            onClick={() => setLeadType(type)}
            className={cn(
              'focus-ring h-10 flex-1 whitespace-nowrap rounded-btn px-3 text-sub font-semibold transition-colors',
              leadType === type
                ? 'bg-surface text-ink shadow-cta-sticky'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {t(`types.${type}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <Field name="name" label={t('name')} required error={errors.name} autoComplete="name" />
        <Field
          name="phone"
          label={t('phone')}
          required
          type="tel"
          error={errors.phone}
          autoComplete="tel"
          placeholder="+38 (0__) ___-__-__"
        />
        <Field
          name="email"
          label={t('email')}
          type="email"
          error={errors.email}
          autoComplete="email"
        />
        <Field name="message" label={t('message')} as="textarea" />

        {/* Honeypot — wrapped in role=presentation + aria-hidden so SRs that
            navigate form elements skip it. Bots that scrape the DOM still see
            it and fill it; the backend silently drops the lead. */}
        <div role="presentation" aria-hidden="true" className="pointer-events-none">
          <label className="sr-only" htmlFor="lead-website">
            Leave this field empty
          </label>
          <input
            id="lead-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
        </div>
      </div>

      {status === 'error-rate' && (
        <div className="mt-5 flex items-start gap-2.5 rounded-input border border-ratelimit-line bg-ratelimit-bg px-4 py-3">
          <span aria-hidden>⏱</span>
          <p className="text-sub font-medium text-ratelimit">{t('errorRate')}</p>
        </div>
      )}
      {status === 'error-generic' && (
        <div className="mt-5 rounded-input border border-danger-line bg-danger-bg px-4 py-3 text-sub font-medium text-danger">
          {t('errorGeneric')}
        </div>
      )}

      <div className="mt-6">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto"
          disabled={sending}
        >
          {sending ? t('sending') : t('submit')}
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  as?: 'input' | 'textarea';
  error?: string;
  autoComplete?: string;
  placeholder?: string;
}

function Field({
  name,
  label,
  type = 'text',
  required,
  as = 'input',
  error,
  autoComplete,
  placeholder,
}: FieldProps) {
  // useId keeps error ids unique even if two LeadForm instances ever share a DOM.
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
