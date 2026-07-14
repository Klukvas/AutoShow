# AutoFlow — backend (v1)

Курована вітрина оголошень про продаж авто для одного бізнесу (автосалону).
Модульний моноліт на NestJS 11 + PostgreSQL 16 + Redis + BullMQ + S3 (MinIO у
деві). Об'яви заводить лише адмін; публічна вітрина — без авторизації.

## TL;DR — запуск

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init
npm install
npm run migration:run
npm run seed
npm run start:dev          # API на http://localhost:3000/api
npm run start:worker:dev   # окремий процес воркера
```

Сваггер: `http://localhost:3000/api/docs`.

Демо-користувачі:

| Роль   | Email                     | Пароль               |
|--------|---------------------------|----------------------|
| admin  | `admin@autoflow.example`  | `Demo!Password12345` |
| editor | `editor@autoflow.example` | `Demo!Password12345` |

## Архітектурні принципи

### Ролі

- **admin** — повний доступ: об'яви, заявки, команда, налаштування сайту,
  audit log, довідники.
- **editor** — контент-менеджер: тільки об'яви та заявки.

### Налаштування сайту (site_settings)

Singleton-рядок з брендингом (лого, кольори, контакти, SEO-дефолти) та
базовою валютою сайту (`default_currency`). Публічний `GET /api/branding`,
адмінський `PATCH /api/admin/branding`.

### Мультивалютна ціна

- При створенні/редагуванні listing вводиться `price_amount + price_currency`
  (USD/UAH/EUR), сервіс рахує `price_normalized` у базовій валюті сайту і
  зберігає `fx_rate + fx_rate_at`.
- Фільтри `priceMin/priceMax` і сортування за ціною — **тільки** по
  `price_normalized`.
- Зміна базової валюти в налаштуваннях НЕ перераховує вже збережені
  `price_normalized` (курс фіксується на момент запису).

### Медіа-флоу

1. `POST /api/admin/listings/:id/media` → бек створює `ListingMedia(status=pending)`
   + presigned PUT.
2. Клієнт PUT-ить файл напряму в S3 (ключ `listings/{listingId}/original/…`).
3. `POST /api/admin/media/:id/confirm` → у BullMQ ставиться задача.
4. Воркер (`MediaProcessorWorker`) перевіряє розмір, читає width/height,
   генерує рендишени `thumb|gallery|full × webp|avif|jpeg`, пише в
   `media_renditions`, ставить `status=ready`. Помилка — `status=failed` +
   `failure_reason`.
5. Орфани (`status=pending` понад `MEDIA_ORPHAN_TTL_HOURS`) видаляються
   `MaintenanceWorker`.

### Перегляди

`ViewCounterService` робить `HINCRBY` у Redis на хіт публічного ендпоінту
карточки. `ViewsFlushWorker` періодично (`VIEW_FLUSH_INTERVAL_SECONDS`) зливає
дельти в `listings.views_count`. Дедуп — `SET NX EX` по IP+listing.

### Refresh-токени

`AuthTokenService` тримає refresh stateful у Redis: ключ — `sha256(token)`,
значення — record з `userId/family`. Ротація: старий токен денілиститься,
видається новий у тій же family. Replay того самого refresh → revoke family +
401.

## Скрипти

| Скрипт                     | Призначення                                |
|----------------------------|--------------------------------------------|
| `npm run start:dev`        | HTTP-додаток, watch                        |
| `npm run start:worker:dev` | BullMQ worker, watch                       |
| `npm run migration:run`    | Прокатати міграції                         |
| `npm run migration:generate -- src/database/migrations/Name` | Згенерувати нову |
| `npm run seed`             | Залити довідники + site settings + демо-дані |
| `npm test`                 | Юніти                                      |

## Структура

```
src/
  app.module.ts           # HTTP-композит
  worker.module.ts        # композит воркера
  main.ts / worker.ts     # entrypoints
  config/                 # env validation, ConfigModule
  common/                 # logger, redis, decorators, filters, pagination, types
  database/
    base/                 # BaseEntity
    migrations/           # TypeORM migrations
    seeds/run-seeds.ts    # довідники + site settings + demo listings
    data-source.ts        # owner DataSource (для CLI/seeds/migrations)
  modules/
    auth/                 # login (brute-force), refresh (rotation), logout
    catalog/              # довідники (public read + admin upsert)
    listings/             # ядро: CRUD, status transitions, public read
    media/                # presigned upload + confirm
    leads/                # public POST + admin list/status
    branding/             # site settings (singleton)
    admin-users/          # CRUD адмінів (admin / editor)
    audit/                # AuditLogService + read API
    notifications/        # абстракція + EmailChannel
    fx/                   # FxRateProvider
    storage/              # S3 abstraction
    slug/, views/         # утиліти
    sitemap/              # sitemap.xml / robots.txt (з PUBLIC_SITE_URL)
  workers/                # BullMQ воркери
```

## Тестове покриття

- `auth-token.service.spec.ts` — ротація refresh, denylist на replay.
- `jwt.guard.spec.ts` — public bypass, 401 без токена, `req.user` з payload.
- `status-transitions.spec.ts` — переходи + оптимістичне блокування.
- `fx-rate.provider.spec.ts` — нормалізація для фільтру за ціною.
- `cursor.spec.ts` — keyset-пагінація round-trip.
- `admin-users.service.spec.ts` — self-guards, унікальність email, revoke токенів.
- `media.service.spec.ts` — валідація MIME, ключі `listings/…`, видалення.

## Не реалізовано в v1 (із спеки)

- Логіка `reservations` (тільки сутність + міграція).
- Імпорт фідів / парсинг (тільки інтерфейс `ListingSourceType`).
- Telegram-канал нотифікацій (тільки інтерфейс `NotificationChannel`).
- SMTP-відправка (EmailChannel логує в stdout без SMTP-конфігурації).

## Безпека

- `JwtAuthGuard` зареєстровано як `APP_GUARD` — будь-який роут без `@Public()`
  вимагає Bearer access-токен.
- `RolesGuard` перевіряє `@Roles(...)` (admin / editor).
- Rate limiting: глобальний `ThrottlerModule` + окремі лімітери на `/auth/login`
  (по IP) та `/leads` (по IP + телефон).
- Honeypot-поле `website` у `CreateLeadDto`.
- argon2id для паролів. Брутфорс-захист: `failed_login_attempts` →
  `locked_until`.
- Public S3 URL не довіряється — оригінали віддаємо через `S3_PUBLIC_URL`,
  рендишени аналогічно. Для прода — приватний бакет + CloudFront/Cloudflare
  перед `S3_PUBLIC_URL`.
- БД: застосунок ходить low-privilege роллю `app_user`; міграції та сиди —
  owner-роллю (`DB_ADMIN_USER`).

## Deploy

- Один сервер (Hetzner). `docker compose up -d` піднімає
  postgres+redis+minio+app+worker.
- `Dockerfile` робить multi-stage build з vips для `sharp`.
- На проді: жорстко випиляти `S3_FORCE_PATH_STYLE`, поставити справжній S3 +
  CloudFront, увімкнути SMTP, виставити `JWT_*_SECRET` з `openssl rand -base64 32`,
  замінити `DB_*_PASSWORD` та `S3_*_KEY`, виставити `PUBLIC_SITE_URL` на
  публічний домен вітрини.
