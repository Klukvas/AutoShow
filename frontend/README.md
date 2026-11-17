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

## Теми вітрини: токени та шрифти

Тема (`src/themes/<id>/`, обирається `STOREFRONT_THEME` під час збірки) може мати не
лише свою розмітку, а й свої дизайн-токени та шрифти. Для цього в КОЖНІЙ папці теми
є два файли (контракт — `src/themes/contract.ts`); `current` і `compact` нічого не
перевизначають, тож виглядають як спільний дизайн:

- `tokens.css` — токени теми. Його імпортує публічний layout (`@theme/tokens.css`),
  тому в image потрапляє CSS лише зібраної теми. Тема без власних токенів лишає файл
  без правил.
- `fonts.ts` — шрифти теми: `export const fonts = { sans, display } satisfies ThemeFonts`.
  Роль `sans` — текст та UI (`--font-sans`), `display` — заголовки й цифри
  (`--font-display`); `null` лишає шрифт застосунку з `src/lib/fonts.ts`.

### tokens.css

Дозволені лише custom properties, які вже оголошені у спільних `src/styles/globals.css`
та `cinematic.css` (кольори — RGB-канали, радіуси `--radius-*`, колір тіні `--shadow`),
зі значенням тієї самої форми (три канали / довжина / колір `rgb()`-`hsl()`), і лише
під селектором вітрини своєї теми:

```css
/* Без режиму: діє і в темному, і у світлому. */
:root body:has([data-storefront-theme='acme']) {
  --bg: 38 12 64;
  --ink: 255 236 179;
  --radius-card: 28px;
  --shadow: 0 0 0;
}

/* Лише світлий режим: перекриває правило вище. */
:root[data-theme='light'] body:has([data-storefront-theme='acme']) {
  --bg: 255 244 214;
  --ink: 70 20 110;
}

/* Зона всередині вітрини, яка сама переоголошує токени (див. нижче). */
:root body:has([data-storefront-theme='acme']) .homepage-cinematic {
  --bg: 38 12 64;
}
```

Селектор починається рівно з одного з трьох написань (лапки — одинарні або подвійні):
`:root body:has([data-storefront-theme='<id>'])`,
`:root[data-theme='light'] body:has(…)`, `:root[data-theme='dark'] body:has(…)`; далі
може йти нащадок.

- **Чому `<body>`, а не обгортка `data-storefront-theme`.** Спільні токени оголошені
  на `<body>` (`.platform-cinematic`), а мобільне меню рендериться порталом у `<body>`,
  тобто ПОЗА обгорткою публічного layout: токени на обгортці його б не дістали.
  `body:has(…)` діє на всю сторінку вітрини разом із порталами. Сторінки адмінки та
  логіну обгортки не мають, тому жодне правило теми на них не спрацьовує.
- **Чому `:root` попереду.** Заради ваги селектора. Спільний CSS переоголошує кольори
  для світлого режиму правилом `[data-theme='light'] .platform-cinematic` (0,2,0);
  `body:has(…)` без `:root` важить (0,1,1): у темному режимі він перемагав би, а у
  світлому мовчки програвав. `:root body:has(…)` важить (0,2,1) і перемагає в обох.
  Тест порівнює цю вагу з усіма спільними правилами, що оголошують токени.
- **Світла й темна.** На сторінках вітрини `data-theme` на `<html>` — `dark` (типово)
  або `light`: його до першого пейнту ставить `ThemeScript`.
  Правило без режиму діє в обох, правило з `[data-theme='light']` чи
  `[data-theme='dark']` — лише у своєму і перекриває правило без режиму. Тобто тема
  пише темну палітру без режиму, а світлу — під `:root[data-theme='light']` (або
  навпаки). Токен, якого тема не задала взагалі, лишається спільним для поточного
  режиму; токен, заданий лише без режиму, однаковий в обох.
- **Зони.** На головній клас `.homepage-cinematic` сам переоголошує на своєму елементі
  темну палітру та радіуси `--radius-chip/btn/input/default/card/hero` (головна завжди
  темна, з гострими кутами), тому токени теми з `<body>` — і кольори, і ці радіуси —
  туди НЕ доходять. Клас ставлять `HomepageShell` (Shell теми `current`) і спільний
  `PublicNav` — на мобільне меню головної. Тема, що використовує будь-який із них і хоче
  змінити головну чи її меню, додає правило `:root body:has(…) .homepage-cinematic`.
  Зони не має лише тема, чий Shell не використовує ні `HomepageShell`, ні `PublicNav`.
- **Акцент автосалону.** `--accent` / `--accent-hover` з адмінки (`/admin/branding`)
  приходять у `<style>` в `<head>` правилами `:root{…}` і `[data-theme='dark']{…}`, тобто
  оголошуються на `<html>` (розділ вище). Тема, яка НЕ задає `--accent` у `tokens.css`,
  зберігає акцент салону: `<body>` його успадковує. Тема, яка задає `--accent`
  (окремо для світлого й темного режимів), свідомо перекриває акцент салону на всій
  вітрині — оголошення на `<body>` сильніше за успадковане. Адмінка в обох випадках
  бачить акцент салону.
- Нового токена в `tokens.css` додати не можна: спершу він має зʼявитися у спільному
  CSS (зі значенням для поточного дизайну). Решта стилів теми — в її `theme.css`.

### fonts.ts

```ts
import { Lora, Playfair_Display } from 'next/font/google';
import type { ThemeFonts } from '../contract';

const sans = Lora({ subsets: ['latin', 'cyrillic'], display: 'swap' });
const display = Playfair_Display({ subsets: ['latin', 'cyrillic'], display: 'swap' });

export const fonts = { sans, display } as const satisfies ThemeFonts;
```

`next/font` викликається тільки тут і в `src/lib/fonts.ts`, тому файли шрифтів теми
потрапляють лише в її image і завантажуються лише сторінками вітрини.
`StorefrontPresentation` вписує у сторінку `<style>`, що перевизначає `--font-sans` /
`--font-display` на `<body>` вітрини, тож шрифт теми отримують і портали. Обидві ролі
обовʼязкові: пропущена роль (а не `null`) зупиняє збірку. Runtime-пресет
`system` (`data-storefront-font`, `src/styles/installations.css`) працює як раніше і
всередині обгортки перемагає шрифт теми.

### Перевірки та відомі обмеження

`src/themes/theme-folders.test.ts` перевіряє: у кожній папці є `tokens.css` і `fonts.ts`;
селектори `tokens.css` — лише вітрина власної теми в одному з трьох написань (жодних
`:root`, `body`, класів, чужого id чи `body:has(…)` без `:root`); вага цього селектора
більша за вагу будь-якого спільного правила з токенами; властивості — лише токени зі
спільного CSS (одруківка в назві падає), а значення мають ту саму форму, що й у
спільному CSS (`--bg: #f00` падає), не посилаються самі на себе (`--bg: var(--bg)`,
цикли `var()`), без `!important`, і стоять усередині правила; жоден інший CSS-файл теми
(`theme.css`) не задає спільних токенів чи `--font-sans` / `--font-display` і не має
`@property`; спільний CSS не `@import`-ить CSS теми й не має `!important` на токенах;
at-rules у `tokens.css` — лише `@media` / `@supports`; `next/font`
імпортують тільки `lib/fonts.ts` і `fonts.ts` тем; `@theme/tokens.css` імпортує лише
публічний layout, `@theme/fonts` — лише `StorefrontPresentation`, яка справді читає
`fonts`; `index.ts` кожної теми перевіряє тип свого `fonts` (`ThemeFontsOf`). Самі правила — у `src/themes/token-guards.ts` з власними
тестами на прийнятні й відхилені приклади (`token-guards.test.ts`).

- Потрібен `:has()` (Chrome/Edge 105+, Safari 15.4+, Firefox 121+). Старіший браузер
  покаже розмітку теми зі спільними токенами та шрифтами застосунку.
- Будь-яка сторінка 404 має спільний вигляд, а не вигляд теми: і невідома адреса, і
  `notFound()` зі сторінки авто чи добірки рендерять `app/not-found.tsx` ПОЗА публічним
  layout (без обгортки `data-storefront-theme`, зі шрифтами застосунку), бо
  `app/(public)/not-found.tsx` немає. Те саме стосується `app/error.tsx` і
  `app/global-error.tsx`. Виняток — `app/(public)/cars/error.tsx`: він усередині
  публічного layout, тож помилка під `/cars` лишається з токенами та шрифтами теми.
  Власна 404 теми — окрема зміна поведінки для наступного етапу.
- 404 невідомої добірки (`/collections/<невідомий ключ>`) віддається взагалі без
  `data-theme` на `<html>` і тому завжди у спільній темній палітрі, навіть якщо
  відвідувач обрав світлу. Це поведінка `origin/main`, теми вона не стосується.
- Не всі кольори спільного CSS є токенами: головна кнопка (`.af-cta.bg-accent`,
  `.platform-primary` у `cinematic.css`) має фіксовані кольори й не читає `--accent`.
  Тема перекриває такі правила у своєму `theme.css`. Так само `cinematic.css` на
  внутрішніх сторінках примушує `.font-heading` до `--font-sans`.
- Спільні правила `@media (prefers-contrast: more)` (вони змінюють `--line`,
  `--line-input`, `--line-strong`, `--ink-3`, а в зоні головної ще й `--ink-2`) слабші
  за будь-яке правило теми: токен, який тема задала, за підвищеного контрасту лишається
  значенням теми, а не спільним. Якщо тема змінює ці токени, підвищений контраст вона
  описує сама — тим самим селектором у `@media (prefers-contrast: more)` в `tokens.css`.
- Кореневий layout і далі preload-ить шрифти застосунку (Onest, Schibsted Grotesk) на
  сторінках вітрини, навіть якщо тема замінила обидві ролі: це зайве завантаження.
  На сторінках вітрини (і динамічних, і SSG, як-от `/collections/<ключ>`) Next надсилає
  preload у HTTP-заголовку `Link`, а не тегами `<link>` у HTML.
- Токени теми стоять на `<body>`; `<html>` (тло під час overscroll) лишається спільним.
- Пресет `system` не діє на портали (як і раніше): у мобільному меню буде шрифт теми.

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
- `STOREFRONT_THEME` задається **під час збірки** (`next build`/`next dev`, Docker
  build-arg): назва папки в `src/themes/`, без значення — `current`; невідома назва
  зупиняє збірку. Image містить лише цю тему, `@theme/<блок>` веде в її папку;
  зміна теми потребує нового image. Тему зібраного image показує `/health/frontend`:
  це id з `src/themes/<id>/id.ts` реально зібраної папки, і збірка падає, якщо він
  не збігається із запитаним `STOREFRONT_THEME` (тому збирати лише webpack —
  Turbopack заміну `@theme` ігнорує). `npm test` завжди працює з темою `current`,
  незалежно від змінної в оточенні. Власні токени та шрифти теми —
  розділ «Теми вітрини: токени та шрифти».
- `ADMIN_COOKIE_SIGNING_KEY` — окремий секрет frontend runtime. Для HTTPS
  `ADMIN_COOKIE_SECURE=true`; явний HTTP-режим потребує `false`.
