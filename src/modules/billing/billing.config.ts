import type { AppConfig } from '../../config/config.module';
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
