import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  Matches,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum PhotoAiMode {
  OwnKey = 'own_key',
  Managed = 'managed',
}

export enum StorefrontTheme {
  Current = 'current',
  Compact = 'compact',
}
export enum StorefrontFont {
  Default = 'default',
  System = 'system',
}

export class EnvSchema {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}$/)
  INSTALLATION_ID: string = 'autoflow';

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
  APP_VERSION: string = 'development';

  @IsEnum(StorefrontTheme)
  STOREFRONT_THEME: StorefrontTheme = StorefrontTheme.Current;

  @IsEnum(StorefrontFont)
  STOREFRONT_FONT_PRESET: StorefrontFont = StorefrontFont.Default;

  @IsBoolean()
  FEATURE_REVIEWS: boolean = true;

  @IsInt()
  @Min(1)
  HEALTH_MIN_FREE_MB: number = 512;

  @IsString()
  @IsOptional()
  PHOTO_AI_ENCRYPTION_KEY?: string;

  @IsString()
  PHOTO_AI_MODEL: string = 'gpt-image-2.5-sunburst';

  @IsInt()
  @Min(10)
  @Max(600)
  PHOTO_AI_TIMEOUT_SECONDS: number = 240;

  @IsInt()
  @Min(1)
  @Max(100)
  PHOTO_AI_JOBS_PER_HOUR: number = 10;

  /**
   * own_key: the site owner stores their own OpenAI key in the admin UI.
   * managed: we provide the key and sell photos in packs (Monobank).
   */
  @IsEnum(PhotoAiMode)
  PHOTO_AI_MODE: PhotoAiMode = PhotoAiMode.OwnKey;

  /** Our OpenAI key for managed mode (secret; never shown in the UI). Trimmed once here. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  PHOTO_AI_MANAGED_API_KEY?: string;

  /** Photos in one purchasable pack (managed mode). */
  @IsInt()
  @Min(1)
  @Max(10_000)
  @IsOptional()
  PHOTO_AI_PACK_SIZE?: number;

  /** Price of one pack in whole UAH (managed mode). */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  PHOTO_AI_PACK_PRICE_UAH?: number;

  /** Text model for AI listing descriptions (Responses API, vision + structured output). */
  @IsString()
  @MinLength(1)
  LISTING_AI_MODEL: string = 'gpt-6.1-sol';

  @IsInt()
  @Min(10)
  @Max(300)
  LISTING_AI_TIMEOUT_SECONDS: number = 90;

  /** Drafts one user may start per hour (each is a paid call). */
  @IsInt()
  @Min(1)
  @Max(500)
  LISTING_AI_JOBS_PER_HOUR: number = 30;

  /** One-time starter descriptions granted on first use (managed mode). */
  @IsInt()
  @Min(0)
  @Max(100_000)
  LISTING_AI_FREE_DESCRIPTIONS: number = 0;

  /** Optional USD price per 1M tokens, only to record a cost estimate per draft. */
  @IsNumber()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  LISTING_AI_INPUT_USD_PER_MTOK?: number;

  @IsNumber()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  LISTING_AI_OUTPUT_USD_PER_MTOK?: number;

  /** Upper bound per draft; reasoning tokens count towards it. */
  @IsInt()
  @Min(1000)
  @Max(32_000)
  LISTING_AI_MAX_OUTPUT_TOKENS: number = 8000;

  /** One-time starter photos granted on first use (managed mode). */
  @IsInt()
  @Min(0)
  @Max(10_000)
  PHOTO_AI_FREE_PHOTOS: number = 0;

  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  PUBLIC_URL: string = 'http://localhost:3000';

  @IsString()
  PUBLIC_SITE_URL: string = 'http://localhost:3001';

  /** Comma-separated origin allowlist for CORS; defaults to PUBLIC_SITE_URL. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  CORRELATION_ID_HEADER: string = 'x-correlation-id';

  @IsString()
  LOG_LEVEL: string = 'info';

  // Express `trust proxy` setting. Governs how req.ip is derived and therefore
  // whether client-supplied X-Forwarded-For can be trusted for rate limiting.
  //   'false' (default) → use the socket IP (unspoofable; correct for a direct
  //     deploy with no reverse proxy).
  //   'true'            → trust the whole XFF chain (ONLY behind a trusted proxy
  //     that overwrites XFF).
  //   a number          → trust exactly N proxy hops.
  //   a subnet string   → trust that CIDR.
  // Set this to match how many trusted proxies actually sit in front of the app.
  @IsString()
  TRUST_PROXY: string = 'false';

  @IsString()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  DB_NAME!: string;

  @IsString()
  DB_ADMIN_USER!: string;

  @IsString()
  DB_ADMIN_PASSWORD!: string;

  @IsString()
  DB_APP_USER!: string;

  @IsString()
  DB_APP_PASSWORD!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsInt()
  @Min(0)
  @Max(15)
  REDIS_DB: number = 0;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL: number = 900;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_REFRESH_TTL: number = 2_592_000;

  @IsInt()
  @Min(1)
  AUTH_MAX_FAILED_ATTEMPTS: number = 5;

  @IsInt()
  @Min(60)
  AUTH_LOCKOUT_SECONDS: number = 900;

  @IsInt()
  @Min(1)
  AUTH_LOGIN_RATE_PER_MIN: number = 10;

  @IsString()
  S3_ENDPOINT!: string;

  @IsString()
  S3_REGION!: string;

  @IsString()
  S3_BUCKET!: string;

  @IsString()
  S3_ACCESS_KEY!: string;

  @IsString()
  S3_SECRET_KEY!: string;

  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean = true;

  @IsString()
  S3_PUBLIC_URL!: string;

  @IsInt()
  @Min(30)
  S3_PRESIGNED_PUT_TTL: number = 600;

  @IsInt()
  @Min(1024)
  MEDIA_MAX_BYTES: number = 20 * 1024 * 1024;

  @IsInt()
  @Min(1)
  MEDIA_ORPHAN_TTL_HOURS: number = 24;

  @IsString()
  FX_PROVIDER: string = 'static';

  @IsString()
  FX_STATIC_USD_UAH!: string;

  @IsString()
  FX_STATIC_USD_EUR!: string;

  @IsString()
  FX_STATIC_EUR_UAH!: string;

  @IsInt()
  @Min(60)
  FX_CACHE_TTL: number = 3600;

  @IsInt()
  @Min(1)
  LEAD_RATE_PER_HOUR: number = 5;

  @IsInt()
  @Min(1)
  PUBLIC_API_RATE_PER_MIN: number = 120;

  @IsInt()
  @Min(60)
  VIEW_DEDUP_TTL_SECONDS: number = 600;

  @IsInt()
  @Min(10)
  VIEW_FLUSH_INTERVAL_SECONDS: number = 60;

  // Hosting subscription (Monobank acquiring). Set by us, never by the client:
  // the price and terms live only here. Off by default → no banner, no block.
  @IsBoolean()
  BILLING_ENABLED: boolean = false;

  /** Monthly fee in whole UAH. Required when BILLING_ENABLED=true. */
  @IsInt()
  @Min(1)
  @IsOptional()
  BILLING_MONTHLY_PRICE_UAH?: number;

  /** Months bought by one payment (invoice amount = price × months). */
  @IsInt()
  @Min(1)
  @Max(12)
  BILLING_PERIOD_MONTHS: number = 1;

  /** Admin banner starts this many days before the paid period ends. */
  @IsInt()
  @Min(0)
  @Max(60)
  BILLING_REMIND_DAYS: number = 7;

  /** Days after the paid period ends before the admin panel is blocked. */
  @IsInt()
  @Min(0)
  @Max(60)
  BILLING_GRACE_DAYS: number = 10;

  /** Seeds paid_until on first use only; later changes are ignored. */
  @IsISO8601({ strict: true })
  @IsOptional()
  BILLING_INITIAL_PAID_UNTIL?: string;

  /** Monobank acquiring X-Token. Required when BILLING_ENABLED=true. */
  @IsString()
  @IsOptional()
  MONOBANK_TOKEN?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const coerced: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(coerced)) {
    const value = coerced[key];
    if (value === '' || value === undefined) {
      delete coerced[key];
    }
  }

  for (const key of ['S3_FORCE_PATH_STYLE', 'BILLING_ENABLED', 'FEATURE_REVIEWS'] as const) {
    const value = coerced[key];
    if (typeof value !== 'string') continue;
    if (value !== 'true' && value !== 'false') {
      throw new Error(`Invalid environment configuration:\n${key}: must be true or false`);
    }
    coerced[key] = value === 'true';
  }

  const instance = plainToInstance(EnvSchema, coerced, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length) {
    const formatted = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  if (instance.PHOTO_AI_ENCRYPTION_KEY) {
    const key = instance.PHOTO_AI_ENCRYPTION_KEY;
    if (
      !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
      Buffer.from(key, 'base64').length !== 32 ||
      Buffer.from(key, 'base64').toString('base64') !== key
    ) {
      throw new Error(
        'Invalid environment configuration: PHOTO_AI_ENCRYPTION_KEY must be a base64 encoded 32-byte key',
      );
    }
  }

  if (instance.BILLING_ENABLED) {
    requireKeys('BILLING_ENABLED=true', [
      ['MONOBANK_TOKEN', instance.MONOBANK_TOKEN],
      ['BILLING_MONTHLY_PRICE_UAH', instance.BILLING_MONTHLY_PRICE_UAH],
    ]);
  }
  if (instance.PHOTO_AI_MODE === PhotoAiMode.Managed) {
    requireKeys('PHOTO_AI_MODE=managed', [
      ['PHOTO_AI_MANAGED_API_KEY', instance.PHOTO_AI_MANAGED_API_KEY],
      ['PHOTO_AI_PACK_SIZE', instance.PHOTO_AI_PACK_SIZE],
      ['PHOTO_AI_PACK_PRICE_UAH', instance.PHOTO_AI_PACK_PRICE_UAH],
      ['MONOBANK_TOKEN', instance.MONOBANK_TOKEN],
    ]);
  }

  // Placeholder secrets from .env.example must never survive into production —
  // a known JWT secret means anyone can forge admin tokens.
  if (instance.NODE_ENV === NodeEnv.Production) {
    const placeholders: Array<[string, string]> = [
      ['JWT_ACCESS_SECRET', instance.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', instance.JWT_REFRESH_SECRET],
    ];
    for (const [name, value] of placeholders) {
      if (value.includes('replace-with') || value.length < 32) {
        throw new Error(
          `Invalid environment configuration:\n${name}: must be a random secret of at least 32 chars in production`,
        );
      }
    }
    if (instance.S3_ACCESS_KEY === 'minioadmin' || instance.S3_SECRET_KEY === 'minioadmin') {
      throw new Error(
        'Invalid environment configuration:\nS3 credentials must not be the MinIO defaults in production',
      );
    }
  }
  return instance;
}

function requireKeys(condition: string, entries: Array<[string, unknown]>): void {
  const missing = entries.filter(
    ([, value]) => value === undefined || (typeof value === 'string' && value.trim() === ''),
  );
  if (!missing.length) return;
  throw new Error(
    `Invalid environment configuration:\n${missing
      .map(([name]) => `${name}: is required when ${condition}`)
      .join('\n')}`,
  );
}
