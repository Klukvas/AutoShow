'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { adminApi } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { fetchAccessToken } from '@/lib/auth/use-access-token';
import type { Branding, Currency } from '@/lib/api/types';
import { deriveHoverHex, isValidHex } from '@/lib/admin/derive-hover';
import { compactHours, DAYS, expandHours, type DayHours } from '@/lib/admin/working-hours-form';
import { dayLabel } from '@/lib/working-hours';
import { Banner } from '@/components/admin/ui/banner';
import { SectionCard } from '@/components/admin/ui/section-card';
import { TextField, inputCls } from '@/components/admin/ui/field';
import { BrandPreview } from './brand-preview';

/** Handoff swatch set; «+» opens the custom picker. */
const SWATCHES = ['#2E53E6', '#E86A2C', '#1F9D57', '#C23B57'];
const CURRENCIES: Currency[] = ['USD', 'EUR', 'UAH'];
const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube'] as const;

interface BrandingEditorProps {
  initial: Branding;
}

/** Handoff 1h: two-column editor with a live re-tinting preview. */
export function BrandingEditor({ initial }: BrandingEditorProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [hours, setHours] = useState<DayHours>(() => expandHours(initial.workingHours));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = <K extends keyof Branding>(key: K, value: Branding[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const accentValid = isValidHex(form.primaryColor);
  const hoverValid = isValidHex(form.accentColor);
  // Preview only complete http(s) URLs — mid-typing fragments would fire a
  // request per keystroke (and javascript: URIs never belong in src).
  const logoPreviewUrl = /^https?:\/\/\S+\.\S+/.test(form.logoUrl ?? '') ? form.logoUrl : null;

  const pickAccent = (hex: string) => {
    setForm((prev) => ({ ...prev, primaryColor: hex, accentColor: deriveHoverHex(hex) }));
  };

  const setDay = (day: (typeof DAYS)[number], slot: { open: string; close: string } | null) =>
    setHours((prev) => ({ ...prev, [day]: slot }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken) {
        setError(t('common.sessionExpired'));
        return;
      }
      await adminApi.updateBranding(
        {
          displayName: form.displayName,
          tagline: form.tagline,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          logoUrl: form.logoUrl,
          faviconUrl: form.faviconUrl,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          address: form.address,
          workingHours: compactHours(hours),
          socialLinks: form.socialLinks,
          seoDefaults: form.seoDefaults,
          defaultCurrency: form.defaultCurrency,
        },
        { accessToken },
      );
      setSuccess(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) setError(t('common.rateLimited'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('common.errorTitle'));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-heading text-[20px] font-extrabold tracking-tight">
          {t('branding.title')}
        </h1>
        <button
          type="submit"
          disabled={pending || !accentValid || !hoverValid}
          className="focus-ring inline-flex h-10 items-center rounded-[9px] bg-accent px-[18px] text-[13px] font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? t('common.saving') : t('branding.save')}
        </button>
      </div>

      {error && (
        <Banner tone="error" className="mb-4">
          {error}
        </Banner>
      )}
      {success && (
        <Banner tone="success" className="mb-4">
          {t('branding.saved')}
        </Banner>
      )}

      <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-2">
        {/* -------- editor column -------- */}
        <div className="flex flex-col gap-[22px]">
          <SectionCard>
            <div className="mb-4 flex items-center gap-3">
              {logoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external logo URL
                <img
                  src={logoPreviewUrl}
                  alt={t('branding.logo')}
                  className="h-[52px] w-[52px] rounded-[11px] border border-line object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-[11px] bg-[#14161B] font-heading text-[22px] font-extrabold text-white"
                >
                  {form.displayName[0]?.toUpperCase() ?? 'A'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <TextField
                  label={t('branding.logoUrl')}
                  value={form.logoUrl ?? ''}
                  onChange={(e) => update('logoUrl', e.target.value || null)}
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3.5">
              <TextField
                label={t('branding.faviconUrl')}
                value={form.faviconUrl ?? ''}
                onChange={(e) => update('faviconUrl', e.target.value || null)}
                placeholder="https://…"
              />
              <TextField
                label={t('branding.name')}
                required
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
              />
              <TextField
                label={t('branding.tagline')}
                value={form.tagline ?? ''}
                onChange={(e) => update('tagline', e.target.value || null)}
              />
            </div>

            {/* Accent swatches + custom */}
            <div className="mt-4">
              <div className="mb-2 block text-[12px] font-semibold text-ink-2">
                {t('branding.accent')}
              </div>
              <div className="flex flex-wrap items-center gap-[9px]">
                {SWATCHES.map((hex) => {
                  const active = form.primaryColor.toUpperCase() === hex.toUpperCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={t('branding.accentSwatch', { hex })}
                      aria-pressed={active}
                      onClick={() => pickAccent(hex)}
                      style={{ background: hex }}
                      className={cn(
                        'focus-ring h-[38px] w-[38px] rounded-[10px]',
                        active && 'shadow-[0_0_0_2px_rgb(var(--surface)),0_0_0_4px_currentColor]',
                      )}
                    />
                  );
                })}
                <label
                  className="focus-ring relative flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-ph-glyph text-[16px] text-ink-3"
                  title={t('branding.accentCustom')}
                >
                  +
                  <input
                    type="color"
                    aria-label={t('branding.accentCustom')}
                    value={accentValid ? form.primaryColor : '#2E53E6'}
                    onChange={(e) => pickAccent(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextField
                  label={t('branding.accent')}
                  value={form.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  error={accentValid ? null : t('branding.colorFormat')}
                />
                <TextField
                  label={t('branding.hover')}
                  value={form.accentColor}
                  onChange={(e) => update('accentColor', e.target.value)}
                  error={hoverValid ? null : t('branding.colorFormat')}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <TextField
                label={t('branding.phone')}
                value={form.contactPhone ?? ''}
                onChange={(e) => update('contactPhone', e.target.value || null)}
                inputMode="tel"
              />
              <div>
                <label
                  htmlFor="branding-currency"
                  className="mb-[5px] block text-[12px] font-semibold text-ink-2"
                >
                  {t('branding.currency')}
                </label>
                <select
                  id="branding-currency"
                  value={form.defaultCurrency}
                  onChange={(e) => update('defaultCurrency', e.target.value as Currency)}
                  className={cn(inputCls(false), 'appearance-none')}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label={t('branding.emailLabel')}
                type="email"
                value={form.contactEmail ?? ''}
                onChange={(e) => update('contactEmail', e.target.value || null)}
              />
              <TextField
                label={t('branding.address')}
                value={form.address ?? ''}
                onChange={(e) => update('address', e.target.value || null)}
              />
            </div>

            {/* Working hours */}
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-semibold text-ink-2">{t('branding.hours')}</div>
              <div className="flex flex-col gap-1.5">
                {DAYS.map((day) => {
                  const slot = hours[day];
                  return (
                    <div key={day} className="flex items-center gap-2.5">
                      <span className="w-8 flex-none text-[12.5px] font-semibold text-ink-2">
                        {dayLabel(day)}
                      </span>
                      <input
                        type="time"
                        aria-label={`${dayLabel(day)} — ${t('branding.openTime')}`}
                        value={slot?.open ?? ''}
                        disabled={slot === null}
                        onChange={(e) =>
                          setDay(day, { open: e.target.value, close: slot?.close ?? '20:00' })
                        }
                        className={cn(inputCls(false), 'h-9 w-[104px] px-2 text-[12.5px]')}
                      />
                      <span aria-hidden className="text-ink-3">
                        –
                      </span>
                      <input
                        type="time"
                        aria-label={`${dayLabel(day)} — ${t('branding.closeTime')}`}
                        value={slot?.close ?? ''}
                        disabled={slot === null}
                        onChange={(e) =>
                          setDay(day, { open: slot?.open ?? '09:00', close: e.target.value })
                        }
                        className={cn(inputCls(false), 'h-9 w-[104px] px-2 text-[12.5px]')}
                      />
                      <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-3">
                        <input
                          type="checkbox"
                          checked={slot === null}
                          onChange={(e) =>
                            setDay(day, e.target.checked ? null : { open: '09:00', close: '20:00' })
                          }
                          className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                        />
                        {t('branding.closed')}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('branding.social')}>
            <div className="flex flex-col gap-3.5">
              {SOCIAL_KEYS.map((key) => (
                <TextField
                  key={key}
                  label={key[0].toUpperCase() + key.slice(1)}
                  value={form.socialLinks?.[key] ?? ''}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = e.target.value
                      ? { ...(form.socialLinks ?? {}), [key]: e.target.value }
                      : Object.fromEntries(
                          Object.entries(form.socialLinks ?? {}).filter(([k]) => k !== key),
                        );
                    update('socialLinks', Object.keys(next).length ? next : null);
                  }}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t('branding.seo')}>
            <div className="flex flex-col gap-3.5">
              <TextField
                label={t('branding.seoTitle')}
                hint={t('branding.seoTitleHint')}
                value={form.seoDefaults?.titleTemplate ?? ''}
                onChange={(e) =>
                  update('seoDefaults', {
                    ...(form.seoDefaults ?? {}),
                    titleTemplate: e.target.value || undefined,
                  })
                }
              />
              <TextField
                label={t('branding.seoDescription')}
                value={form.seoDefaults?.description ?? ''}
                onChange={(e) =>
                  update('seoDefaults', {
                    ...(form.seoDefaults ?? {}),
                    description: e.target.value || undefined,
                  })
                }
              />
            </div>
          </SectionCard>
        </div>

        {/* -------- live preview column -------- */}
        <div className="rounded-[12px] bg-surface-2 p-5 lg:sticky lg:top-6">
          <BrandPreview
            name={form.displayName}
            accent={accentValid ? form.primaryColor : initial.primaryColor}
            accentHover={hoverValid ? form.accentColor : initial.accentColor}
            logoUrl={form.logoUrl}
          />
        </div>
      </div>
    </form>
  );
}
