import { resolveLocale, type Locale } from '@/i18n/locales';
import type { Currency } from './api/types';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  UAH: '₴',
  EUR: '€',
};

/**
 * Editorial-grade money formatter: thin-space thousands grouping (matches
 * European typesetting), no decimals when amount is integer, currency glyph
 * leading — sized by the consumer with TabularNumber.
 */
export function formatMoney(amount: string | number, currency: Currency): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  const integer = Math.round(num);
  const grouped = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${CURRENCY_SYMBOL[currency] ?? currency} ${grouped}`;
}

const UNITS: Record<Locale, { thousandKm: string; km: string; hp: string; liter: string }> = {
  uk: { thousandKm: 'тис. км', km: 'км', hp: 'к.с.', liter: 'л' },
  ru: { thousandKm: 'тыс. км', km: 'км', hp: 'л. с.', liter: 'л' },
  en: { thousandKm: 'k km', km: 'km', hp: 'hp', liter: 'L' },
};

export function formatMileage(km: number, locale?: string | null): string {
  if (!Number.isFinite(km)) return '—';
  const unit = UNITS[resolveLocale(locale)];
  if (km >= 1000) {
    const thousands = Math.round(km / 1000)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${thousands} ${unit.thousandKm}`;
  }
  return `${km} ${unit.km}`;
}

export function formatPowerHp(hp: number, locale?: string | null): string {
  return `${hp} ${UNITS[resolveLocale(locale)].hp}`;
}

export function formatEngineVolume(volume: string, locale?: string | null): string {
  const trimmed = String(volume).replace(/\.0$/, '');
  return `${trimmed} ${UNITS[resolveLocale(locale)].liter}`;
}

export function formatYear(year: number): string {
  return String(year);
}
