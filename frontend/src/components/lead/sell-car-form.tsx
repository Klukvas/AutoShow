'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PACKAGE_PICK_EVENT } from '@/components/home/package-pick-link';
import { HoneypotField, LeadField } from '@/components/lead/field';
import { PackageSelect } from '@/components/lead/package-select';
import { ApiClientError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import type { PublicPlacementPackage } from '@/lib/api/types';

type Status = 'idle' | 'sending' | 'success' | 'error-rate' | 'error-generic';

interface FieldErrors {
  name?: string;
  phone?: string;
  carMake?: string;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// Stable default: a fresh [] per render would re-subscribe the pick listener every time.
const NO_PACKAGES: PublicPlacementPackage[] = [];

/**
 * Consignment intake: "sell your car through us". Submits a `sell_request`
 * lead with the visitor's car details — lands in the same admin inbox as
 * buyer inquiries. With placement packages published, the visitor can pick
 * paid placement instead; a tariff card's "Обрати" preselects it.
 */
export function SellCarForm({ packages = NO_PACKAGES }: { packages?: PublicPlacementPackage[] }) {
  const t = useTranslations('sell');
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [packageId, setPackageId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onPick = (event: Event) => {
      const picked = (event as CustomEvent<string>).detail;
      if (packages.some((pkg) => pkg.id === picked)) {
        setPackageId(picked);
        // A pick after a sent request starts a new one rather than hiding behind "Дякуємо".
        setStatus((current) => (current === 'success' ? 'idle' : current));
      }
    };
    window.addEventListener(PACKAGE_PICK_EVENT, onPick);
    return () => window.removeEventListener(PACKAGE_PICK_EVENT, onPick);
  }, [packages]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    const carMake = String(form.get('carMake') ?? '').trim();

    const nextErrors: FieldErrors = {
      ...(name ? {} : { name: t('errorRequired') }),
      ...(isValidPhone(phone) ? {} : { phone: t('errorPhone') }),
      ...(carMake ? {} : { carMake: t('errorRequired') }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const year = Number(String(form.get('carYear') ?? '').trim());
    const mileage = Number(String(form.get('carMileageKm') ?? '').replace(/\D/g, ''));

    setStatus('sending');
    publicApi
      .submitLead({
        type: 'sell_request',
        name,
        phone,
        carMake,
        carModel: String(form.get('carModel') ?? '').trim() || undefined,
        carYear: Number.isInteger(year) && year >= 1950 ? year : undefined,
        carMileageKm: Number.isInteger(mileage) && mileage > 0 ? mileage : undefined,
        packageId: packageId || undefined,
        message: String(form.get('message') ?? '').trim() || undefined,
        sourceUrl: window.location.href,
        website: String(form.get('website') ?? ''),
      })
      .then(() => {
        formRef.current?.reset();
        setPackageId('');
        setStatus('success');
      })
      .catch((err) => {
        setStatus(
          err instanceof ApiClientError && (err.status === 403 || err.status === 429)
            ? 'error-rate'
            : 'error-generic',
        );
      });
  };

  if (status === 'success') {
    return (
      <div className="flex items-start gap-3 rounded-input bg-ok-bg p-4">
        <span aria-hidden className="text-ok">
          ✓
        </span>
        <p className="text-body-md font-medium text-ok">{t('success')}</p>
      </div>
    );
  }

  const sending = status === 'sending';

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      {packages.length > 0 && (
        <div className="mb-4">
          <PackageSelect packages={packages} value={packageId} onChange={setPackageId} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <LeadField name="carMake" label={t('carMake')} required error={errors.carMake} placeholder="Toyota" />
        <LeadField name="carModel" label={t('carModel')} placeholder="Camry" />
        <LeadField name="carYear" label={t('carYear')} inputMode="numeric" placeholder="2019" />
        <LeadField name="carMileageKm" label={t('carMileage')} inputMode="numeric" placeholder="85 000" />
        <LeadField name="name" label={t('name')} required error={errors.name} autoComplete="name" />
        <LeadField
          name="phone"
          label={t('phone')}
          required
          type="tel"
          error={errors.phone}
          autoComplete="tel"
          placeholder="+38 (0__) ___-__-__"
        />
      </div>
      <div className="mt-4">
        <LeadField name="message" label={t('comment')} as="textarea" />
      </div>
      <HoneypotField id="sell-website" />

      {status === 'error-rate' && (
        <p className="mt-4 rounded-input border border-ratelimit-line bg-ratelimit-bg px-4 py-3 text-sub font-medium text-ratelimit">
          {t('errorRate')}
        </p>
      )}
      {status === 'error-generic' && (
        <p className="mt-4 rounded-input border border-danger-line bg-danger-bg px-4 py-3 text-sub font-medium text-danger">
          {t('errorGeneric')}
        </p>
      )}

      <div className="mt-5">
        <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto" disabled={sending}>
          {sending ? t('sending') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
