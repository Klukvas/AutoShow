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

  describe('photo AI mode', () => {
    const managed = {
      PHOTO_AI_MODE: 'managed',
      PHOTO_AI_MANAGED_API_KEY: 'sk-managed',
      PHOTO_AI_PACK_SIZE: '50',
      PHOTO_AI_PACK_PRICE_UAH: '300',
      MONOBANK_TOKEN: 'tok',
    };

    it('defaults to own_key with no free photos', () => {
      const config = validateEnv(exampleEnv());
      expect(config.PHOTO_AI_MODE).toBe('own_key');
      expect(config.PHOTO_AI_FREE_PHOTOS).toBe(0);
    });

    it('accepts managed mode with key, pack terms and a Monobank token (billing off)', () => {
      const config = validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_FREE_PHOTOS: '5' });
      expect(config.PHOTO_AI_MODE).toBe('managed');
      expect(config.PHOTO_AI_PACK_SIZE).toBe(50);
      expect(config.PHOTO_AI_PACK_PRICE_UAH).toBe(300);
      expect(config.PHOTO_AI_FREE_PHOTOS).toBe(5);
      expect(config.BILLING_ENABLED).toBe(false);
    });

    it.each([
      'PHOTO_AI_MANAGED_API_KEY',
      'PHOTO_AI_PACK_SIZE',
      'PHOTO_AI_PACK_PRICE_UAH',
      'MONOBANK_TOKEN',
    ] as const)('requires %s in managed mode', (key) => {
      const env: Record<string, string> = { ...exampleEnv(), ...managed };
      delete env[key];
      expect(() => validateEnv(env)).toThrow(`${key}: is required when PHOTO_AI_MODE=managed`);
    });

    it('rejects an unknown mode and invalid pack numbers', () => {
      expect(() => validateEnv({ ...exampleEnv(), PHOTO_AI_MODE: 'free' })).toThrow(
        'PHOTO_AI_MODE',
      );
      expect(() => validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_PACK_SIZE: '0' })).toThrow(
        'PHOTO_AI_PACK_SIZE',
      );
      expect(() =>
        validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_PACK_PRICE_UAH: '-1' }),
      ).toThrow('PHOTO_AI_PACK_PRICE_UAH');
      expect(() => validateEnv({ ...exampleEnv(), PHOTO_AI_FREE_PHOTOS: '-2' })).toThrow(
        'PHOTO_AI_FREE_PHOTOS',
      );
    });

    it('trims the managed key once at startup', () => {
      const config = validateEnv({
        ...exampleEnv(),
        ...managed,
        PHOTO_AI_MANAGED_API_KEY: '  sk-managed \n',
      });
      expect(config.PHOTO_AI_MANAGED_API_KEY).toBe('sk-managed');
    });

    it('rejects a blank managed key and absurd pack prices', () => {
      expect(() =>
        validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_MANAGED_API_KEY: '   ' }),
      ).toThrow('PHOTO_AI_MANAGED_API_KEY: is required when PHOTO_AI_MODE=managed');
      expect(() =>
        validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_PACK_PRICE_UAH: '1000001' }),
      ).toThrow('PHOTO_AI_PACK_PRICE_UAH');
      expect(() =>
        validateEnv({ ...exampleEnv(), ...managed, PHOTO_AI_PACK_SIZE: '10001' }),
      ).toThrow('PHOTO_AI_PACK_SIZE');
      expect(() => validateEnv({ ...exampleEnv(), PHOTO_AI_FREE_PHOTOS: '10001' })).toThrow(
        'PHOTO_AI_FREE_PHOTOS',
      );
    });

    it('does not require managed settings in own_key mode', () => {
      expect(() => validateEnv({ ...exampleEnv(), PHOTO_AI_MODE: 'own_key' })).not.toThrow();
    });
  });
});
