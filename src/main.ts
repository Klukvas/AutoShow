import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { EnvSchema } from './config/env.validation';

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : value;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const config = app.get(ConfigService) as ConfigService<EnvSchema, true>;

  const prefix = config.get('API_PREFIX', { infer: true });
  app.setGlobalPrefix(prefix);
  // Derive `trust proxy` from config instead of hardcoding 1 (which trusted a
  // client-supplied X-Forwarded-For on a direct deploy, letting attackers spoof
  // req.ip and bypass rate limiting). Default 'false' → unspoofable socket IP.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY', { infer: true })));
  // 'extended' (qs) parses bracket arrays like `options[]=leather&options[]=camera`
  // into { options: ['leather','camera'] }. Express 5's default 'simple' parser
  // leaves the literal key `options[]`, silently dropping the facet filter.
  app.getHttpAdapter().getInstance().set('query parser', 'extended');
  // Echoing every Origin back with credentials would let ANY site read
  // credentialed responses (token theft / CSRF surface). Allowlist only.
  const corsOrigins = (config.get('CORS_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = corsOrigins.length
    ? corsOrigins
    : [config.get('PUBLIC_SITE_URL', { infer: true })];
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('AutoFlow API')
    .setDescription('Curated car listings backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(`/${prefix}`)
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${prefix}/docs`, app, doc);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  app.get(PinoLogger).log(`AutoFlow listening on http://0.0.0.0:${port}/${prefix}`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
