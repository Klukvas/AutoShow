import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { validateEnv } from './env.validation';

const exampleEnv = () =>
  parse(readFileSync(join(process.cwd(), '.env.example'), { encoding: 'utf8' }));

describe('validateEnv', () => {
  it('accepts the example env file', () => {
    const config = validateEnv(exampleEnv());
    expect(config.PUBLIC_SITE_URL).toBe('http://localhost:3001');
  });

  it('parses false boolean strings as false', () => {
    const config = validateEnv({
      ...exampleEnv(),
      S3_FORCE_PATH_STYLE: 'false',
    });

    expect(config.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('rejects invalid boolean strings', () => {
    expect(() => validateEnv({ ...exampleEnv(), S3_FORCE_PATH_STYLE: 'definitely' })).toThrow(
      'S3_FORCE_PATH_STYLE: must be true or false',
    );
  });

  it('rejects a missing required key', () => {
    const env = exampleEnv();
    delete env.DB_HOST;
    expect(() => validateEnv(env)).toThrow('DB_HOST');
  });

  it('keeps billing disabled by default with documented terms', () => {
    const config = validateEnv(exampleEnv());
    expect(config.BILLING_ENABLED).toBe(false);
    expect(config.BILLING_PERIOD_MONTHS).toBe(1);
    expect(config.BILLING_REMIND_DAYS).toBe(7);
    expect(config.BILLING_GRACE_DAYS).toBe(10);
  });

  it('requires MONOBANK_TOKEN and the price when billing is enabled', () => {
    expect(() => validateEnv({ ...exampleEnv(), BILLING_ENABLED: 'true' })).toThrow(
      'MONOBANK_TOKEN: is required when BILLING_ENABLED=true',
    );
    expect(() =>
      validateEnv({ ...exampleEnv(), BILLING_ENABLED: 'true', MONOBANK_TOKEN: 'tok' }),
    ).toThrow('BILLING_MONTHLY_PRICE_UAH: is required when BILLING_ENABLED=true');
  });

  it('accepts enabled billing with token, price and an initial paid-until date', () => {
    const config = validateEnv({
      ...exampleEnv(),
      BILLING_ENABLED: 'true',
      MONOBANK_TOKEN: 'tok',
      BILLING_MONTHLY_PRICE_UAH: '1500',
      BILLING_INITIAL_PAID_UNTIL: '2026-11-01T00:00:00Z',
    });
    expect(config.BILLING_ENABLED).toBe(true);
    expect(config.BILLING_MONTHLY_PRICE_UAH).toBe(1500);
  });

  it('rejects invalid billing values', () => {
    expect(() => validateEnv({ ...exampleEnv(), BILLING_ENABLED: 'yes' })).toThrow(
      'BILLING_ENABLED: must be true or false',
    );
    expect(() => validateEnv({ ...exampleEnv(), BILLING_INITIAL_PAID_UNTIL: 'soon' })).toThrow(
      'BILLING_INITIAL_PAID_UNTIL',
    );
    expect(() => validateEnv({ ...exampleEnv(), BILLING_MONTHLY_PRICE_UAH: '0' })).toThrow(
      'BILLING_MONTHLY_PRICE_UAH',
    );
  });
});
