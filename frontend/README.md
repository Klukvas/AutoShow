# AutoFlow — Frontend (v1)

Публічна вітрина в дусі кінематографічного editorial + утилітарна
адмін-панель. Парний продукт до бекенда AutoFlow (Next.js 15, App Router,
RSC, TypeScript).

## Запуск

```bash
cd frontend
cp .env.example .env
npm install
npm run dev    # http://localhost:3001
```

Бекенд має бути піднятий на `http://localhost:3000/api`. Сайт відкривається
просто на `http://localhost:3001` — жодних маніпуляцій з `Host` не потрібно.

## Тести

```bash
npm test                       # юніт-тести (Vitest): формат, тема, JSON-LD escaping, години
npx playwright install chromium  # один раз
npm run test:e2e               # E2E (Playwright) проти піднятого стеку (фронт+бек+сиди)
```

E2E-специ в `e2e/` очікують запущений повний стек (див. `playwright.config.ts`):
публічна вітрина (home → каталог → `/cars/[slug]` + canonical, форма ліда),
адмінка (логін → створення обʼяви → редагування з інкрементом версії) та
мобільна навігація (`mobile.spec.ts`: бургер-меню на 390px).

## Адаптив

Повністю адаптивний — від 390px:
- Публічна шапка: інлайн-лінки на desktop, на мобілі — бургер + повноекранне
  меню (портал у `body`, щоб не просвічувати hero).
- Каталог: сітка карток 1→2→3 колонки; фільтри на мобілі — sticky-кнопка +
  повноекранний sheet.
- Адмінка: фіксований сайдбар 240px на desktop, на мобілі — топ-бар + висувний
  drawer; таблиці горизонтально прокручуються.

## Стек

- **Next.js 15 (App Router)** + React Server Components — SSR для SEO, статичні
  ре-валідації для каталогу/картки.
- **TypeScript** — типи дзеркалять контракти бекенда (`src/lib/api/types.ts`).
- **Tailwind** з жорстко кастомним конфігом: radius=0 всюди, типошкала §3,
  палітра через CSS variables (§2), tabular-nums як utility.
- **next/font** + Inter (full Cyrillic, tabular figures) — single typeface,
  личность через вагу і масштаб.
- **next-intl** — основний `uk`.
- **Framer Motion + Lenis** — оркестрований reveal героя + один scroll-reveal
  для карток. Hover/press — миттєвий.

## Дизайн-ДНК (§1)

- Чорно-білий cinematic editorial, червоний акцент строго в дозі.
- Гострі кути, hairline-розділювачі, без тіней і скруглень.
- Image-forward картки, oversize tabular-числа як підпис продукту (§5).
- Рух — у двох-трьох оркестрованих моментах (hero, scroll-reveal), все інше —
  миттєво.

## Архітектура

```
frontend/
├── messages/uk.json              # i18n (next-intl)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # корінь — резолвить branding, інлайнить theme
│   │   ├── not-found.tsx
│   │   ├── (public)/             # editorial showcase
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Home
│   │   │   ├── cars/
│   │   │   │   ├── page.tsx      # Catalog
│   │   │   │   └── [slug]/page.tsx  # Detail
│   │   │   ├── about/page.tsx
│   │   │   └── contacts/page.tsx
│   │   └── (admin)/admin/        # dense utility dashboard (інша естетика!)
│   │       ├── login/page.tsx    # поза auth-гейтом
│   │       ├── api/token/route.ts
│   │       └── (dashboard)/      # auth-гейт у layout.tsx групи
│   │           ├── layout.tsx
│   │           ├── listings/...
│   │           ├── leads/page.tsx
│   │           ├── team/page.tsx
│   │           ├── branding/page.tsx
│   │           └── audit/page.tsx
│   ├── components/
│   │   ├── hero/cinematic-hero.tsx
│   │   ├── listing/{listing-card,spec-readout,gallery,load-more}.tsx
│   │   ├── filters/filter-bar.tsx
│   │   ├── lead/lead-form.tsx
│   │   ├── motion/{lenis-provider,scroll-reveal}.tsx
│   │   ├── nav/{public-nav,public-footer}.tsx
│   │   ├── ui/{button,label,tabular-number,filter-chip,media-picture}.tsx
│   │   └── admin/{data-table,status-badge,media-uploader,...}.tsx
│   ├── lib/
│   │   ├── api/{client,public,admin,types}.ts
│   │   ├── auth/{session,actions,refresh}.ts
│   │   ├── branding/{resolve,theme}.ts
│   │   ├── seo/json-ld.tsx
│   │   ├── format.ts
│   │   ├── cn.ts
│   │   └── fonts.ts
│   ├── styles/globals.css
│   └── i18n/request.ts
└── tailwind.config.ts
```

## Темізація сайту (§6)

1. RSC `getSiteBranding()` шле `GET /branding` на бекенд (singleton site
   settings, кешується через fetch revalidate + tag `branding`).
2. `brandingThemeCss()` повертає inline-CSS з `--accent` / `--accent-hover`.
3. Корінь `<head>` рендерить `<style>` ДО першого пейнту — нуль FOUC.
4. `--focus` (жовтий) у токенах і ніколи не переозначається брендингом.

Дефолт = racing red `#DA291C`. Свій колір задається через адмін-панель
`/admin/branding` — на публічній вітрині оновлення зʼявляється протягом
revalidate window (~5 хв).

> **Токен-контракт (важливо):** усі колірні CSS-змінні зберігаються як
> **RGB-канали** (`--ink: 23 19 14`), а не hex — щоб Tailwind-модифікатор
> `/opacity` міг згенерувати `rgb(var(--ink) / 0.2)`. У Tailwind-конфізі колір =
> `rgb(var(--x) / <alpha-value>)`; у сирому CSS звертайся через `rgb(var(--x))`.
> `brandingThemeCss()` конвертує brand-hex у канали (`hexToRgbChannels`).
> Виняток — `--hairline-*` (готова rgba, без `/opacity`). Хекс безпосередньо в
> `var(--x)` для кольору **не працюватиме**.

## SEO

- `generateMetadata` на кожній публічній сторінці.
- JSON-LD `Vehicle` віддає бекенд (`seo.jsonLd`), фронт лиш робить
  `<script type="application/ld+json">` (екрановано через `JSON.stringify`).
- `next/image` з рендишенами AVIF/WebP, hero `priority`.
- Sitemap і robots — на бекенді (`/sitemap.xml`, `/robots.txt`).

## Lighthouse-цілі (§11)

| Метрика        | Ціль                      |
| -------------- | ------------------------- |
| Performance    | ≥ 95 на каталозі і картці |
| SEO            | ≥ 95                      |
| A11y           | ≥ 95                      |
| Best Practices | ≥ 95                      |

LCP — героїчне фото (priority + sized + preload через next/image). TBT
тримаємо коротким: RSC за замовчуванням, клієнтський JS — лише форми,
галерея, фільтри, MediaUploader.

## Адмін-панель

- Логін: server action → бекенд `/auth/login` (з брутфорс-захистом).
  Refresh-токени в HttpOnly cookie; `lib/auth/refresh.ts` ротує перед
  закінченням TTL.
- Список обʼяв з курсорною пагінацією, перехід на детальну.
- Створення обʼяви (`/admin/listings/new`) і редагування (`/admin/listings/:id/edit`)
  спільним компонентом `ListingForm` (create/edit-режими): залежний список
  моделей, повний набір полів, версіювання (оптимістична блокировка, 409).
- Завантаження медіа — точно за бекенд-флоу:
  `POST /admin/listings/:id/media` → presigned PUT → `POST /admin/media/:id/confirm`
  → воркер генерує рендишени.
- Переходи статусу шлють поточний `version` (оптимістична блокировка); 409
  показуємо як «хтось щойно змінив, перезавантажте».
- Інбокс лідів зі зміною статусу.
- Редактор брендингу з live-превʼ.
- Розділ «Команда»: `admin` створює акаунти співробітників (роль `editor`)
  за email і паролем, блокує/активує та видаляє їх. `editor` бачить лише
  обʼяви та заявки.
- Audit log read-only.

## A11y і motion (§12, §7)

- Усі інтерактиви мають жовтий focus-ring (`outline: 2px solid var(--focus)`).
- Галерея — клавіатура: ←/→.
- `prefers-reduced-motion` ріже Lenis, Framer Motion reveals і всі
  transition; правило в `globals.css`.
- Контраст: білий на `#181818` — AA. Червоний CTA — AA для UI/крупного тексту.

## Що НЕ реалізовано в v1 (за спекою §15)

- Особистий кабінет покупця.
- Оплата / бронь на фронті (reservations — FUTURE на бекенді).
- Тяжкі UI-кіти.
- Анімації на мікроінтеракціях.

## Deploy

### Google Analytics 4 (необовʼязково)

Без `NEXT_PUBLIC_GA_MEASUREMENT_ID` аналітика вимкнена: Google script не
завантажується, CSP не дозволяє Google endpoints. Потрібен Measurement ID
вебпотоку GA4: `G-` і 10 великих латинських літер/цифр. Некоректний ID також
вимикає інтеграцію; Release відхиляє непорожнє некоректне значення.

Перед увімкненням у GA4 → Admin → Data streams → Web stream вимкніть
**Enhanced measurement** (зокрема автоматичні page views за history changes,
form interactions та site search). Вітрина сама надсилає один `page_view`
під час першого відкриття і переходів між pathname через Next.js.
`send_page_view: false` прибирає config-view, але сам по собі не вимикає
автоматичні history views — це окреме обовʼязкове налаштування вебпотоку.

Локально задайте ID у власному frontend env і перезапустіть dev server.
У production задайте GitHub Environment variable `NEXT_PUBLIC_GA_MEASUREMENT_ID`
для `installation-ID`, зберіть новий Release frontend image і окремо застосуйте
bundle за [інструкцією деплою](../deploy/README.md). ID публічний, це не API secret.
Next.js вшиває його та CSP під час build: зміна runtime env або restart існуючого
image не вмикає й не вимикає GA. Для вимкнення очистіть variable і перебудуйте image.

Збираються тільки публічні перегляди; `/admin` не підключає tag, а перехід з
вітрини в адмінку встановлює GA opt-out для вже завантаженого tag. Query string,
fragment, початковий document referrer і поля форм не передаються; внутрішній
referrer містить лише попередній публічний pathname. Рекламні signals вимкнені.
Наявна backend-аналітика переглядів оголошень працює окремо.

Після активації перевірте GA4 Realtime/DebugView: публічна сторінка → інша
публічна сторінка → admin; без дублювання `page_view` і без admin events.
Розширення браузера, що блокують аналітику, можуть завадити перевірці.

Порядок незалежного розгортання кожного автосалону, image pins і секрети описані
в [канонічній інструкції деплою](../deploy/README.md).

- Браузер звертається до same-origin `/api`; `NEXT_PUBLIC_BACKEND_URL` не потрібна.
  У production цей шлях маршрутизує Caddy, у Next dev — локальний rewrite.
- `BACKEND_INTERNAL_URL` задає внутрішню адресу для серверних API-запитів під час
  виконання (у compose — `http://app:3000/api`). SEO rewrites Next фіксують цю
  адресу під час збірки; у production SEO-файли маршрутизує Caddy.
- `NEXT_PUBLIC_MEDIA_HOSTS` задається **під час збірки** та формує точні allowlists
  для `next/image` і CSP, зокрема presigned uploads. Зміна media origin потребує
  нового frontend image/bundle із того самого спільного коду.
- `ADMIN_COOKIE_SIGNING_KEY` — окремий секрет frontend runtime. Для HTTPS
  `ADMIN_COOKIE_SECURE=true`; явний HTTP-режим потребує `false`.
