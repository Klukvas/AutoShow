export const CURRENCIES = ['USD', 'UAH', 'EUR'] as const;

export type Currency = (typeof CURRENCIES)[number];
