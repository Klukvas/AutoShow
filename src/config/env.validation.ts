import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvSchema {
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

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsInt()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  EMAIL_FROM!: string;

  @IsString()
  @IsOptional()
  LEAD_NOTIFY_TO?: string;

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
}

export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const coerced: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(coerced)) {
    const value = coerced[key];
    if (value === '' || value === undefined) {
      delete coerced[key];
    }
  }

  for (const key of ['S3_FORCE_PATH_STYLE'] as const) {
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
