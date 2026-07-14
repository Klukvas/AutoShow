import { FxRateProvider } from './fx-rate.provider';

const redisMock = {
  client: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  },
};

const config = {
  FX_CACHE_TTL: 3600,
  FX_STATIC_USD_UAH: '41.5',
  FX_STATIC_USD_EUR: '0.92',
  FX_STATIC_EUR_UAH: '45.0',
};

describe('FxRateProvider — normalization for filter-by-price', () => {
  let provider: FxRateProvider;
  beforeEach(() => {
    redisMock.client.get.mockResolvedValue(null);
    provider = new FxRateProvider(config as never, redisMock as never);
  });

  it('returns identity rate for same-currency conversion', async () => {
    const r = await provider.getRate('USD', 'USD');
    expect(r.rate).toBe('1.000000');
  });

  it('USD -> UAH uses configured rate', async () => {
    const r = await provider.getRate('USD', 'UAH');
    expect(r.rate).toBe('41.5');
  });

  it('UAH -> USD is inverted from USD -> UAH', async () => {
    const r = await provider.getRate('UAH', 'USD');
    expect(Number(r.rate)).toBeCloseTo(1 / 41.5, 6);
  });

  it('convert produces a normalized amount used by filters/sort', async () => {
    const result = await provider.convert('10000', 'USD', 'UAH');
    expect(Number(result.value)).toBeCloseTo(10000 * 41.5, 1);
    expect(result.rate).toBe('41.5');
  });
});
