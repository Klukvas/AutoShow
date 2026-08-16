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
- Зміна базової валюти в налаштуваннях перераховує `price_normalized`
  (+ `fx_rate`, `fx_rate_at`) для всіх живих оголошень в одній транзакції з
  оновленням налаштувань. Курси v1 — статичні з env (`FX_STATIC_*`), тож перед
  зміною бази варто перевірити їх актуальність.

### Консигнація (авто клієнтів)

- `seller_type='client'` вимагає телефон продавця; `fee_type='percent'/'fixed'`
  вимагає відповідну ставку (> 0). Правила застосовуються в домені —
  create/update/publish — а не тільки у формі адмінки.
- Комісія фіксується один раз у момент `mark-sold`; відсутня ставка — це 422,
  а не мовчазна комісія 0.
- **Свідоме рішення:** ім'я та телефон приватного продавця віддаються
  публічним API, поки авто не продане — покупець контактує продавця напряму.
  Згоду клієнта на публікацію контактів салон отримує під час прийому авто.

### Публікація

`POST /admin/listings/:id/publish` перевіряє готовність оголошення: щонайменше
одне оброблене фото, наявність VIN за увімкненого `vinVisible`, консистентні
поля консигнації. Інакше — 422 зі списком причин (чернетки лишаються
вільноформатними).

### Логотипи марок

- `catalog_makes.logo_s3_key` — монохромна іконка марки в єдиному стилі
  (simple-icons через jsDelivr, безкоштовно і без ключів): однодоріжковий SVG
  гліф рендериться в 512px прозорий PNG у фіксованому ink-тоні та кладеться в
  наш S3 (`catalog/makes/{slug}.png`). Слаг підбирається за кандидатами
  (`mercedes-benz` → `mercedes`). Якщо гліфа немає — в UI лишається
  буква-аватар у тому ж стилі, повторна спроба через тиждень
  (`logo_checked_at`, sweep у `MaintenanceWorker`).
- Створення марки (`POST /admin/catalog/makes`) ставить задачу на завантаження
  лого в чергу `maintenance`; для марок, створених до фічі, працює той самий
  щогодинний sweep.
- У формі об'яви марка/модель — combobox з лого і пошуком: невідома назва →
  повідомлення + кнопка «Створити» прямо в дропдауні (доступно admin і
  editor; решта каталогу — тільки admin). Нова марка одразу доступна, лого
  доїжджає фоном.
- Публічний `GET /api/catalog/makes` віддає `logoUrl`; на `/cars` над сіткою —
  смуга брендів-ярликів (тільки марки з завантаженим лого).

### Публікація в Telegram-канали

- Налаштування — в адмінці (Брендинг → Telegram): токен бота з @BotFather,
  до 10 каналів (`@name` або `-100…`), тумблер автопублікації. Бот має бути
  адміністратором каналу. Токен зберігається в `site_settings.telegram`,
  ніколи не віддається публічним API / editor-токенам і маскується в audit log.
- Автопост — при ПЕРШІЙ публікації об'яви (BullMQ-черга `telegram`); повторні
  публікації дублів не створюють. Ручна кнопка — на сторінці редагування
  об'яви (постить лише в канали, де поста ще немає).
- Формат — альбом до 10 фото (jpeg-рендишени gallery) з підписом: рік, пробіг,
  двигун, КПП, місто, ціна і посилання на сайт. При `mark-sold` підпис поста
  редагується на «✅ ПРОДАНО» з закресленою ціною.
- Ідемпотентність — рядок `listing_telegram_posts` на (listing, chat) з
  partial-unique індексом; ретраї безпечні.
- Обмеження: Telegram завантажує фото за URL, тож медіа-домен має бути
  публічно доступним (на проді так; з локального MinIO пост не пройде).

### Медіа-флоу

1. `POST /api/admin/listings/:id/media` → бек створює `ListingMedia(status=pending)`
   + presigned PUT.
2. Клієнт PUT-ить файл напряму в S3 (ключ `listings/{listingId}/original/…`).
3. `POST /api/admin/media/:id/confirm` → у BullMQ ставиться задача.
4. Воркер (`MediaProcessorWorker`) перевіряє розмір, читає width/height,
   генерує рендишени `thumb|gallery|full × webp|avif|jpeg`, пише в
   `media_renditions`, ставить `status=ready`. Помилка — `status=failed` +
   `failure_reason`.
5. Орфани (`status=pending` понад `MEDIA_ORPHAN_TTL_HOURS`) і failed-медіа
   (старші за той самий TTL) видаляються `MaintenanceWorker` разом з
   S3-об'єктами; `failure_reason` до того видно в адмінці.

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
- Telegram-нотифікації про заявки для менеджерів (тільки інтерфейс
  `NotificationChannel`; публікація об'яв у канали — реалізована, див. вище).

SMTP-відправка реалізована: `EmailChannel` шле листи через nodemailer, коли
задано `SMTP_HOST` (без нього — лише лог). Якщо `LEAD_NOTIFY_TO` порожній,
бекенд пише warning при старті — заявки зберігаються, але нікого не
сповіщають.

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
