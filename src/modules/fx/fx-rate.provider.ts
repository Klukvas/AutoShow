import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import { RedisService } from '../../common/redis/redis.service';
import type { Currency } from '../../common/types/currency';

export interface FxQuote {
  rate: string;
  asOf: Date;
}

/**
 * Currency conversion abstraction. v1 uses static rates from env; FUTURE we
 * can drop in a HTTP-backed provider behind this interface without touching
 * the listings module.
 *
 * `convert()` always returns a non-zero rate — for same-currency requests the
 * rate is 1.000000 with `now()` as `asOf`.
 */
@Injectable()
export class FxRateProvider {
  private readonly logger = new Logger(FxRateProvider.name);
  private readonly cacheTtl: number;
  private readonly staticRates: Map<string, string>;

  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {
    this.cacheTtl = config.FX_CACHE_TTL;
    this.staticRates = new Map<string, string>([
      ['USD->UAH', config.FX_STATIC_USD_UAH],
      ['UAH->USD', this.invert(config.FX_STATIC_USD_UAH)],
      ['USD->EUR', config.FX_STATIC_USD_EUR],
      ['EUR->USD', this.invert(config.FX_STATIC_USD_EUR)],
      ['EUR->UAH', config.FX_STATIC_EUR_UAH],
      ['UAH->EUR', this.invert(config.FX_STATIC_EUR_UAH)],
    ]);
  }

  async getRate(from: Currency, to: Currency, asOf: Date = new Date()): Promise<FxQuote> {
    if (from === to) {
      return { rate: '1.000000', asOf };
    }
    const key = `fx:${from}:${to}`;
    const cached = await this.redis.client.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as { rate: string; asOf: string };
      return { rate: parsed.rate, asOf: new Date(parsed.asOf) };
    }

    const rate = this.staticRates.get(`${from}->${to}`);
    if (!rate) {
      throw new Error(`No FX rate configured for ${from} -> ${to}`);
    }
    const quote: FxQuote = { rate, asOf };
    await this.redis.client.setex(
      key,
      this.cacheTtl,
      JSON.stringify({ rate, asOf: asOf.toISOString() }),
    );
    return quote;
  }

  async convert(
    amount: string,
    from: Currency,
    to: Currency,
  ): Promise<{ value: string; rate: string; asOf: Date }> {
    const quote = await this.getRate(from, to);
    const value = (Number(amount) * Number(quote.rate)).toFixed(2);
    return { value, rate: quote.rate, asOf: quote.asOf };
  }

  private invert(rate: string): string {
    const r = Number(rate);
    if (!r) throw new Error(`Cannot invert zero FX rate ${rate}`);
    return (1 / r).toFixed(6);
  }
}
