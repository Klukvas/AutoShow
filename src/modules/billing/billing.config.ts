import type { AppConfig } from '../../config/config.module';
import { PhotoAiMode } from '../../config/env.validation';
import { addMonthsUtc, type BillingTerms } from './billing-state';

export const BILLING_SETTINGS = 'BILLING_SETTINGS';

/** Validated billing knobs derived once from env (see env.validation.ts). */
export interface BillingSettings extends BillingTerms {
  isEnabled: boolean;
  monthlyPriceUah: number;
  periodMonths: number;
  initialPaidUntil: Date | null;
  monobankToken: string;
  /** Where Monobank POSTs status changes (backend public URL). */
  webhookUrl: string;
  /** Where the payer returns after paying (admin billing page). */
  redirectUrl: string;
  /** Managed photo-AI packs — independent of hosting billing (isEnabled). */
  photoPacks: PhotoPackSettings;
}

export interface PhotoPackSettings {
  isEnabled: boolean;
  size: number;
  priceUah: number;
  freePhotos: number;
  /** Where the payer returns after buying a pack (photo-AI settings). */
  redirectUrl: string;
}

/**
 * Webhooks/syncs keep working whenever a token is configured — even after a
 * feature was switched off, an already-issued invoice may still get paid.
 */
export function isMonobankConfigured(settings: BillingSettings): boolean {
  return settings.monobankToken.trim() !== '';
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export function buildBillingSettings(config: AppConfig): BillingSettings {
  const prefix = config.API_PREFIX.replace(/^\/+|\/+$/g, '');
  return {
    isEnabled: config.BILLING_ENABLED,
    monthlyPriceUah: config.BILLING_MONTHLY_PRICE_UAH ?? 0,
    periodMonths: config.BILLING_PERIOD_MONTHS,
    remindDays: config.BILLING_REMIND_DAYS,
    graceDays: config.BILLING_GRACE_DAYS,
    initialPaidUntil: config.BILLING_INITIAL_PAID_UNTIL
      ? new Date(config.BILLING_INITIAL_PAID_UNTIL)
      : null,
    monobankToken: config.MONOBANK_TOKEN ?? '',
    webhookUrl: `${trimSlash(config.PUBLIC_URL)}/${prefix}/billing/monobank/webhook`,
    redirectUrl: `${trimSlash(config.PUBLIC_SITE_URL)}/admin/billing?returned=1`,
    photoPacks: {
      isEnabled: config.PHOTO_AI_MODE === PhotoAiMode.Managed,
      size: config.PHOTO_AI_PACK_SIZE ?? 0,
      priceUah: config.PHOTO_AI_PACK_PRICE_UAH ?? 0,
      freePhotos: config.PHOTO_AI_FREE_PHOTOS,
      redirectUrl: `${trimSlash(config.PUBLIC_SITE_URL)}/admin/branding?photoPackReturned=1`,
    },
  };
}

/** Invoice amount in kopecks for one payment period. */
export function invoiceAmountKop(settings: BillingSettings): number {
  return settings.monthlyPriceUah * settings.periodMonths * 100;
}

/** paid_until for the very first account row: configured date, else now + one period. */
export function seedPaidUntil(settings: BillingSettings, now: Date): Date {
  return settings.initialPaidUntil ?? addMonthsUtc(now, settings.periodMonths);
}
