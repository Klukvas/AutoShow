'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HoneypotField, LeadField } from '@/components/lead/field';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Currency } from '@/lib/api/types';

/**
 * Indicative annual rate for the estimate. The disclaimer states the final
 * terms come from the bank — the calculator's job is to turn a price tag
 * into a monthly figure a buyer can react to.
 */
const ANNUAL_RATE = 0.22;
const TERMS = [12, 24, 36, 48, 60, 84] as const;
const DOWN_PAYMENT_STEPS = [0.2, 0.3, 0.4, 0.5] as const;

function monthlyPayment(principal: number, months: number): number {
  const r = ANNUAL_RATE / 12;
  if (principal <= 0) return 0;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

type Status = 'idle' | 'sending' | 'success' | 'error';

interface CreditCalculatorProps {
  listingId: string;
  priceAmount: string;
  currency: Currency;
}

/** Handoff-consistent card: sliders → monthly payment → "buy on credit" lead. */
export function CreditCalculator({ listingId, priceAmount, currency }: CreditCalculatorProps) {
  const t = useTranslations('credit');
  const price = Number(priceAmount);
  const [downShare, setDownShare] = useState<number>(0.3);
  const [term, setTerm] = useState<number>(36);
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  const downPayment = Math.round(price * downShare);
  const monthly = useMemo(
    () => monthlyPayment(price - downPayment, term),
    [price, downPayment, term],
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    const digits = phone.replace(/\D/g, '');
    if (!name || digits.length < 10 || digits.length > 15) {
      setPhoneError(t('errorPhone'));
      return;
    }
    setPhoneError(undefined);
    setStatus('sending');
    publicApi
      .submitLead({
        type: 'credit',
        name,
        phone,
        listingId,
        creditDownPayment: downPayment,
        creditTermMonths: term,
        sourceUrl: window.location.href,
        website: String(form.get('website') ?? ''),
      })
      .then(() => {
        formRef.current?.reset();
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        if (err instanceof ApiClientError && err.status === 429) setPhoneError(t('errorRate'));
      });
  };

  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <h2 className="font-heading text-section font-bold text-ink">{t('title')}</h2>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-label font-semibold uppercase text-ink-2">
            {t('downPayment')}
          </span>
          <div className="flex flex-wrap gap-2">
            {DOWN_PAYMENT_STEPS.map((share) => (
              <button
                key={share}
                type="button"
                onClick={() => setDownShare(share)}
                aria-pressed={downShare === share}
                className={cn(
                  'focus-ring h-10 rounded-btn border px-4 text-sub font-semibold transition-colors',
                  downShare === share
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line-input text-ink-2 hover:border-ink-3',
                )}
              >
                {Math.round(share * 100)}%
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sub text-ink-3">
            {formatMoney(String(downPayment), currency)}
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-label font-semibold uppercase text-ink-2">
            {t('term')}
          </span>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setTerm(months)}
                aria-pressed={term === months}
                className={cn(
                  'focus-ring h-10 rounded-btn border px-3.5 text-sub font-semibold transition-colors',
                  term === months
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line-input text-ink-2 hover:border-ink-3',
                )}
              >
                {t('months', { count: months })}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-input bg-bg p-4">
          <p className="text-sub text-ink-2">{t('monthlyLabel')}</p>
          <p className="tabular mt-0.5 font-heading text-price-md font-extrabold text-ink">
            ≈ {formatMoney(monthly.toFixed(0), currency)}
            <span className="text-sub font-medium text-ink-3"> / {t('perMonth')}</span>
          </p>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{t('disclaimer')}</p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="mt-4 flex items-start gap-3 rounded-input bg-ok-bg p-4">
          <span aria-hidden className="text-ok">
            ✓
          </span>
          <p className="text-body-md font-medium text-ok">{t('success')}</p>
        </div>
      ) : formOpen ? (
        <form ref={formRef} onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3.5">
          <LeadField name="name" label={t('name')} required autoComplete="name" />
          <LeadField
            name="phone"
            label={t('phone')}
            required
            type="tel"
            error={phoneError}
            autoComplete="tel"
            placeholder="+38 (0__) ___-__-__"
          />
          <HoneypotField id="credit-website" />
          <Button type="submit" variant="primary" size="lg" disabled={status === 'sending'}>
            {status === 'sending' ? t('sending') : t('submitRequest')}
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-4 w-full"
          onClick={() => setFormOpen(true)}
        >
          {t('cta')}
        </Button>
      )}
    </div>
  );
}
