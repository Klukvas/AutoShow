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

export function formatMileage(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km >= 1000) {
    return `${Math.round(km / 1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} тис. км`;
  }
  return `${km} км`;
}

export function formatPowerHp(hp: number): string {
  return `${hp} к.с.`;
}

export function formatEngineVolume(volume: string): string {
  const trimmed = String(volume).replace(/\.0$/, '');
  return `${trimmed} л`;
}

export function formatYear(year: number): string {
  return String(year);
}
