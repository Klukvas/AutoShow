# AutoFlow — карта фич

Документ нужен для быстрой продуктовой и бизнес-ориентации: какие фичи есть, кто ими
пользуется, где они видны (UI/API) и какие у них ключевые ограничения.

Обновлено: 2026-10-16.

Ссылки на источники — это пути в репозитории (ориентир, где искать), а не построчная
документация кода. Фичи, реализованные частично или отсутствующие, помечены явно —
см. раздел 12.

---

## 1. Роли и доступ

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публичный доступ без авторизации | Посетитель сайта | Витрина `/cars`, `/cars/[slug]`, публичные формы заявок; `frontend/src/app/(public)`, `src/modules/listings/listings-public.controller.ts`, `src/modules/leads/leads-public.controller.ts` | Доступа в админку нет вообще; публичные эндпоинты отдают только опубликованные данные |
| Роль `editor` | Контент-менеджер | Админка: объявления (CRUD без удаления, статусы, массовые публикация/архивация, медиа и повтор обработки, ручной пост в Telegram, выбор тегов), лиды (список, статусы, ответственный, follow-up, заметки), страница `/admin/catalog` (создание и правка марок/моделей, логотипы — без удаления), добавление цвета по названию, ИИ-обработка фото — если разрешено настройкой доступа; `frontend/src/app/(admin)/admin/(dashboard)/layout.tsx`, `src/modules/listings/listings-admin.controller.ts`, `src/modules/leads/leads-admin.controller.ts`, `src/modules/catalog/catalog-admin.controller.ts` | Нет доступа к команде, отзывам, аудиту, аналитике, тегам и коллекциям (CRUD), оплате — разделы скрыты в меню и закрыты на бэкенде; брендинг только на чтение без секретов Telegram; никогда не видит цены хостинга, баланс фото и даты оплаты. При заблокированной оплате видит только экран «обслуговування не оплачено» и кнопку выхода |
| Роль `admin` | Владелец / руководитель | Полный доступ: брендинг и Telegram-токен, команда, отзывы, аудит, аналитика, каталог (включая удаление), теги, коллекции, настройки ИИ-фото и пакеты фото, оплата хостинга; `src/modules/branding`, `src/modules/admin-users`, `src/modules/audit`, `src/modules/analytics`, `src/modules/billing`, `src/modules/photo-ai` | Единственная роль, видящая секреты Telegram, журнал аудита, цены и баланс; при заблокированной оплате может зайти только на страницу оплаты |
| Блокировка за неоплату | Все сотрудники | Глобальный `BillingGuard` (`src/modules/billing/billing.guard.ts`) | Когда оплата хостинга в состоянии `blocked`, все админские запросы получают 402, кроме страницы оплаты и `GET /auth/me`; публичный сайт работает. Подробно — раздел 13 |
| Авторизация и сессии | Сотрудники админки | `login` / `refresh` / `logout` / `me`; `src/modules/auth/*`, `frontend/src/app/(admin)/admin/login/page.tsx` | JWT access-токен + refresh-токен с ротацией в Redis; повторное использование старого refresh отзывает сессию (replay revoke) |

## 2. Публичная витрина

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Главная страница | Посетитель | `frontend/src/app/(public)/page.tsx`, `src/modules/analytics/stats-public.controller.ts`, `frontend/src/components/home/services-section.tsx` | Hero, блок услуг (ведёт на форму продажи, тег «обмен» или каталог), подборки, отзывы, блок доверия со статистикой; статистика считается по публичным данным |
| Каталог `/cars` | Посетитель | `frontend/src/app/(public)/cars/page.tsx`, `src/modules/listings/listings-public.controller.ts` | Фильтры: марка, модель, кузов, топливо, коробка, привод, состояние, город, цена, год, пробег, опции, теги, поиск `q`; сортировка и курсорная пагинация (не offset) |
| Карточка объявления в списке | Посетитель | `frontend/src/components/listing/listing-card.tsx` | Медиа, цена, статус, теги, плашка «↓N%» при снижении цены, пометка «Фото оброблено ШІ» / «Сцену змінено ШІ», если фото обработано ИИ |
| Страница автомобиля `/cars/[slug]` | Посетитель | `frontend/src/app/(public)/cars/[slug]/page.tsx`, `frontend/src/components/listing/*` | Галерея, характеристики, опции, похожие автомобили, шаринг, мобильный CTA, формы заявок |
| Избранное и сравнение | Посетитель | `frontend/src/app/(public)/favorites/page.tsx`, `frontend/src/app/(public)/compare/page.tsx`, `frontend/src/lib/compare.tsx` | Списки хранятся на клиенте (без аккаунта): избранное до 100, сравнение до 3 авто, синхронизация между вкладками; страницы вычищают удалённые и снятые с публикации автомобили. Сравнение — только фронтенд, отдельного API нет |
| Статические и маркетинговые страницы | Посетитель | `frontend/src/app/(public)/about/page.tsx`, `frontend/src/app/(public)/contacts/page.tsx`, `frontend/src/app/(public)/collections/[key]/page.tsx` | Контакты и тексты берутся из брендинга; коллекции — отдельные лендинги по ключу, хранятся в БД |
| Снижение цены | Посетитель | `src/modules/listings/listings.mapper.ts` | «↓N%» на карточке и «Ціна знижена ↓N%» на странице авто — только при реальном снижении; истории цены в виде графика или API нет |

## 3. Объявления / автомобили в админке

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Добавление автомобиля | editor, admin | `frontend/src/components/admin/listings/listing-form.tsx`, `src/modules/listings/listings.service.ts` | Создаётся черновик: генерируется slug, валидируются справочники каталога, цена нормализуется по курсу, пишется базовая точка истории цены, в аудит идёт `listing.create` |
| Редактирование | editor, admin | `PATCH` объявления; `src/modules/listings/listings.service.ts` | Оптимистичная блокировка по версии (конфликт при параллельном редактировании); проданные объявления только на чтение; изменение цены пишет историю и поля снижения цены |
| Удаление | admin | `src/modules/listings/listings.service.ts` | Мягкое удаление объявления, медиа и рендишенов; событие `listing.delete` в аудите. editor удалять не может |
| Список и поиск в админке | editor, admin | `frontend/src/app/(admin)/admin/(dashboard)/listings/page.tsx`, `frontend/src/components/admin/listings/listings-table.tsx` | Фильтр по статусу и поиск `q`, курсорная пагинация, таблица с тулбаром действий |
| Переходы статусов | editor, admin | `src/modules/listings/listings-admin.controller.ts`, `frontend/src/components/admin/listings/transition-menu.tsx` | Публикация, архивация, бронь и снятие брони, отметка о продаже |
| Массовые операции | editor (без удаления), admin | `POST /api/admin/listings/bulk` | Публикация, архивация, удаление — до 100 объявлений за раз; результат по каждому объявлению отдельно; удаление только admin |
| Теги в форме | editor, admin | `frontend/src/components/admin/listings/listing-form.tsx` | Выбор опубликованных тегов при создании и редактировании |
| Готовность к публикации | editor, admin | `src/modules/listings/listings.service.ts` | Нужно хотя бы одно фото в статусе `ready`; VIN обязателен, если включён `vinVisible`; комиссионные поля должны быть валидны; при повторной публикации первый `publishedAt` сохраняется |
| Отметка «продано» | editor, admin | `src/modules/listings/listings.service.ts` | Проставляются `soldAt`, `salePriceAmount`, `commissionAmount`; если не задана ставка комиссии — ответ 422 |
| Комиссионные / клиентские автомобили | editor, admin | `src/modules/listings/dto/create-listing.dto.ts`, `src/modules/listings/entities/listing.entity.ts` | Для `sellerType = client` обязателен `sellerPhone`; при `feeType` percent/fixed обязательна ставка; комиссия считается в момент продажи |

## 4. Медиа

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Загрузка через presigned URL | editor, admin | `src/modules/media/media.service.ts`, `frontend/src/components/admin/media/media-manager.tsx` | Сервер создаёт запись `pending` и PUT-ссылку, клиент грузит файл напрямую в S3, затем confirm проверяет наличие объекта |
| Обработка изображений | Система (воркер) | `src/workers/media-processor.worker.ts` | Генерируются рендишены thumb/gallery/full в webp/avif/jpeg; статус медиа становится `ready` или `failed` |
| Видео | editor, admin | `src/modules/media/media.service.ts` | Confirm может помечать видео как `ready` без рендишенов изображений |
| Менеджер медиа | editor, admin | `frontend/src/components/admin/media/*` | Обложка, порядок, удаление, повтор обработки для `failed` (`POST /api/admin/media/:id/retry`); причина сбоя (`failure_reason`) видна в интерфейсе; кнопка «Редагувати з ШІ» на готовом фото |
| Очистка мусора | Система (воркер) | `src/workers/maintenance.worker.ts` | Удаляет застрявшие `pending` и старые `failed` записи вместе с объектами в S3 |

## 5. Лиды и CRM

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публичные формы заявок | Посетитель | `src/modules/leads/leads-public.controller.ts`, `frontend/src/components/listing/contact-panel.tsx`, `frontend/src/components/listing/credit-calculator.tsx` | Типы: `callback`, `message`, `test_drive`, `sell_request`, `credit`; honeypot-спам обрабатывается как no-op (посетитель видит успех, лид не создаётся); есть рейт-лимит |
| Структурированные детали заявки | Менеджер | `src/modules/leads/entities/lead.entity.ts`, `src/modules/leads/leads.service.ts` | Данные по продаже и кредиту пишутся в JSON-поле `Lead.details` — схема не реляционная, валидируется на входе |
| Входящие и CRM | editor, admin | `frontend/src/app/(admin)/admin/(dashboard)/leads/page.tsx`, `frontend/src/components/admin/leads/lead-crm-panel.tsx` | Список лидов (фильтр только по статусу), статусы `new` / `in_progress` / `done` / `spam`; ответственный (активный сотрудник), дата follow-up, заметки (1..2000 символов, нельзя править и удалять). Follow-up только хранится — напоминаний нет. Лиды удалённого сотрудника становятся без ответственного |
| Живое уведомление в админке | editor, admin | `frontend/src/components/admin/leads/lead-live-notifier.tsx`, `frontend/src/lib/admin/lead-watch.ts` | Поллинг каждые 25 с + тост о новых лидах; это не вебсокеты |
| Алерты по лидам | Менеджер (Telegram) | `src/modules/notifications/*`, `src/modules/leads/leads.service.ts` | Реальные лиды ставят задачу на Telegram-алерт менеджеру; сбой постановки в очередь не ломает ответ посетителю (ошибка логируется) |

## 6. Telegram и уведомления

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публикация объявлений в канал | admin (настройка) | `frontend/src/components/admin/branding/branding-editor.tsx`, `src/modules/branding/entities/site-settings.entity.ts` | Раздел «Брендинг → Telegram»: токен бота, список каналов, флаг `autoPublish` |
| Автопостинг | Система | `src/modules/listings/listings.service.ts`, `src/modules/telegram/*` | Первая публикация ставит задачу в очередь Telegram; дубликаты невозможны — уникальность `ListingTelegramPost` по паре объявление/чат |
| Ручной пост | editor, admin | `frontend/src/components/admin/listings/telegram-post-panel.tsx`, `src/modules/telegram/telegram-admin.controller.ts` | Панель в карточке объявления отправляет только в те каналы, где поста ещё нет |
| Формат поста | Подписчик канала | `src/modules/telegram/telegram-caption.ts`, `src/workers/telegram.worker.ts` | Альбом до 10 фото, подпись с характеристиками, ценой и ссылкой на сайт; если фото обработаны ИИ — строка-пометка об этом; при отметке «продано» подпись редактируется на SOLD |
| Уведомления о лидах | Менеджер | `src/modules/notifications/telegram-channel.ts` | Тот же токен бота, но отдельный чат менеджера (`leadChatId`) |
| Безопасность и лимиты | admin | `src/modules/branding/branding.service.ts`, `src/modules/telegram/telegram-api.client.ts` | `botToken` и `leadChatId` не отдаются публично и не видны роли `editor`, в аудите маскируются; ссылки на медиа должны быть публично доступны, иначе Telegram не заберёт файлы |

## 7. Брендинг и настройки сайта

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| `SiteSettings` | admin | `src/modules/branding/entities/site-settings.entity.ts` | Логотип и favicon, цвета, отображаемое название и слоган, контакты, адрес, часы работы, соцсети, SEO-дефолты, `defaultCurrency`, конфигурация Telegram |
| Публичный брендинг | Посетитель | `src/modules/branding/branding-public.controller.ts` | Публичный эндпоинт отдаёт настройки без секретов Telegram |
| Редактор брендинга | admin (правка), editor (чтение) | `frontend/src/app/(admin)/admin/(dashboard)/branding/page.tsx`, `src/modules/branding/branding-admin.controller.ts` | admin правит брендинг, SEO, валюту и Telegram; на этой же странице — настройки ИИ-фото и панель пакетов фото (раздел 14); editor получает урезанную версию брендинга только на чтение |
| Смена базовой валюты | admin | `src/modules/branding/branding.service.ts` | Перенормализует цены всех объявлений и сбрасывает предыдущую базу для расчёта снижения цены — операция массовая, выполнять осознанно |

## 8. Каталог, теги и коллекции

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Справочники каталога | Посетитель (чтение), admin, editor (частично) | `src/modules/catalog/*` | Марки, модели, кузова, топливо, коробки, приводы, цвета, опции; публичное чтение и админское управление |
| Страница каталога `/admin/catalog` | editor, admin | `frontend/src/components/admin/catalog/catalog-manager.tsx` | Создание и правка марок и моделей, загрузка/удаление логотипа; удаление марок/моделей — только admin и только если они не используются (иначе 409) |
| Создание марки/модели «на лету» | editor, admin | `frontend/src/components/admin/listings/catalog-combobox.tsx` | Можно создать марку или модель прямо из формы объявления, не уходя в раздел каталога |
| Цвета | editor, admin | `frontend/src/components/admin/listings/color-field.tsx`, миграция `1792000500000-CatalogDefaultColors` | 18 цветов по умолчанию; новый цвет добавляется по названию (slug транслитерируется с украинского); повторное имя возвращает существующий цвет; editor задаёт только название |
| Логотипы марок | Система, editor, admin | `src/modules/catalog/make-logo.service.ts`, `src/modules/catalog/catalog-logo.service.ts`, `src/workers/maintenance.worker.ts` | Режимы: авто (simple-icons через jsDelivr, при неудаче maintenance-воркер повторяет попытку), ручная загрузка PNG/JPEG/WebP до 2 МБ, без логотипа; удалённый вручную логотип автоматически не возвращается |
| Теги | Посетитель (бейджи и фильтры), admin (управление), editor (выбор) | `src/modules/catalog/entities/tag.entity.ts`, `frontend/src/app/(admin)/admin/(dashboard)/tags/page.tsx` | Теги видны на карточках и в фильтре `?tags[]=` (все выбранные сразу, только опубликованные); нельзя удалить используемый тег; сид создаёт 4 стартовых тега |
| Коллекции | Посетитель, admin | `src/modules/collections/*`, `frontend/src/app/(admin)/admin/(dashboard)/collections/page.tsx` | Кураторские SEO/маркетинговые лендинги по ключу с сохранёнными фильтрами; хранятся в БД, публикация и порядок, попадают в sitemap; сид создаёт 5 подборок |

## 9. Отзывы, команда, аудит, аналитика

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Отзывы | Посетитель (чтение), admin | `src/modules/reviews/*`, `frontend/src/app/(admin)/admin/(dashboard)/reviews/page.tsx` | Публично видны только опубликованные отзывы; модерация — в админском менеджере |
| Команда / пользователи админки | admin | `src/modules/admin-users/*`, `frontend/src/app/(admin)/admin/(dashboard)/team/page.tsx` | admin создаёт и ведёт аккаунты редакторов |
| Журнал аудита | admin | `src/modules/audit/*`, `frontend/src/app/(admin)/admin/(dashboard)/audit/page.tsx` | Фиксирует важные действия по объявлениям, медиа, брендингу, пользователям, Telegram и лидам; фильтры доступны только admin |
| Аналитика | admin | `src/modules/analytics/*`, `frontend/src/app/(admin)/admin/(dashboard)/page.tsx` | Дашборд: сводные карточки, продажи по месяцам (6 мес.), конверсия просмотров в лиды, источники лидов по UTM за 30 дней, топ-просмотры с числом лидов; данные кешируются на 60 с; только для admin |

## 10. SEO и фоновые процессы

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| SEO-разметка объявлений | Поисковые системы | `frontend/src/app/(public)/cars/[slug]/page.tsx` | Метаданные, canonical, JSON-LD на публичных страницах автомобилей |
| Sitemap и `llms.txt` | Поисковые системы, LLM-краулеры | `src/modules/sitemap/*`, `frontend/src/app/llms.txt/route.ts` | Sitemap собирается на бэкенде, `llms.txt` отдаёт фронтенд-роут |
| Счётчик просмотров | Посетитель (неявно), admin (отчёты) | `src/modules/views/*`, `src/workers/views-flush.worker.ts` | Дедупликация и `HINCRBY` в Redis, периодический сброс в `listings.views_count` — значение в БД отстаёт на интервал флаша |
| Воркеры | Система | `src/workers/*` | Медиа, Telegram, уведомления, просмотры, обслуживание, ИИ-фото; без запущенных воркеров очереди копятся |
| Проверки CI и деплой | Разработчик | `.github/workflows/*`, `deploy/*` | Бэкенд- и фронтенд-проверки описаны в workflow и документации деплоя |

## 11. Интеграции и окружение

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| PostgreSQL + TypeORM | Система | `src/config/*`, `README.md` | Схема ведётся миграциями TypeORM |
| Redis + BullMQ | Система | `src/workers/*`, `src/config/*` | Очереди задач, ротация refresh-токенов, дедупликация просмотров — Redis обязателен |
| S3 / MinIO | Система, editor, admin | `docker-compose.yml`, `src/modules/media/*` | Хранилище медиа; в dev используется MinIO |
| Telegram Bot API | Система | `src/modules/telegram/*`, `src/modules/notifications/*` | Внешний сервис: лимиты и доступность на его стороне |
| simple-icons / jsDelivr | Система | `src/modules/catalog/make-logo.service.ts` | Источник логотипов марок, внешняя сеть |
| Курсы валют | Система | `src/config/*`, `.env.example` | Статические курсы из переменных окружения `FX_STATIC_*` |
| Monobank (эквайринг) | Система, admin | `src/modules/billing/monobank.client.ts` | Оплата хостинга и пакетов фото; входящий webhook `/api/billing/monobank/webhook` с проверкой подписи; токен `MONOBANK_TOKEN`. Для проверок есть тестовый токен Monobank |
| OpenAI Images | Система | `src/modules/photo-ai/photo-ai.provider.ts` | ИИ-обработка фото (`images/edits`, модель `PHOTO_AI_MODEL`); ключ — свой у клиента или наш (managed) |
| Переменные биллинга и ИИ | Разработчик / деплой | `.env.example`, `deploy/.env.production.example` | `BILLING_*`, `PHOTO_AI_*`, `MONOBANK_TOKEN`; в workflow деплоя не синхронизируются — задаются вручную на сервере (кроме `PHOTO_AI_ENCRYPTION_KEY`: деплой генерирует его один раз, если он отсутствует). Полный список — README |
| Docker + Caddy | Разработчик / деплой | `docker-compose.yml`, `deploy/*` | Прод разворачивается через Compose, TLS и проксирование — на Caddy |
| Swagger | Разработчик | `/api/docs` | Документация API бэкенда |

## 12. Не реализовано / частично реализовано

| Фича | Статус | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Бронирование и оплата покупателем | Частично (только модель данных) | Сущность `Reservation` и миграция есть | Реального флоу брони и оплаты покупателем нет; статус `reserved` выставляется вручную. Оплата хостинга и пакетов фото салоном реализована (разделы 13–14) |
| Импорт из фидов / парсер | Не реализовано | Поле `sourceType` присутствует | Сам процесс импорта отсутствует — поле заполняется вручную |
| Внешний провайдер курсов и автообновление | Не реализовано | — | Используются только статические курсы `FX_STATIC_*` из окружения |
| Email-уведомления о лидах | Удалено осознанно | — | Алерты по лидам идут только в Telegram; email-канал убран из кодовой базы |
| Полноценный CRM / воронка сделок | Частично | Мини-CRM лида | Есть статусы, ответственный, дата follow-up и заметки; нет этапов сделки, задач и напоминаний по follow-up |
| История цены (график / API) | Не реализовано | — | История пишется в БД, но наружу отдаётся только признак снижения цены |
| Telegram и локальные медиа | Ограничение окружения | `src/modules/telegram/telegram-api.client.ts` | Локальные URL MinIO недостижимы для Telegram, поэтому в dev посты с фото могут падать |
| Линейка пакетов фото | Не реализовано | `PHOTO_AI_PACK_SIZE` | Поддерживается только один размер пакета |
| Учёт себестоимости ИИ-фото | Не реализовано | — | Расход токенов OpenAI не сохраняется |

## 13. Оплата хостинга (Monobank)

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Включение | Вендор (через env) | `BILLING_ENABLED`, `BILLING_MONTHLY_PRICE_UAH`, `BILLING_PERIOD_MONTHS`, `BILLING_REMIND_DAYS`, `BILLING_GRACE_DAYS`, `BILLING_INITIAL_PAID_UNTIL`, `MONOBANK_TOKEN` | По умолчанию выключено: нет баннеров и блокировки. Цену и сроки задаём мы, клиент изменить не может |
| Состояния | Система | `src/modules/billing/billing-state.ts` | `active` → `due_soon` (за 7 дней до срока) → `overdue` (срок прошёл, 10 дней льготы) → `blocked` |
| Напоминание | admin | `frontend/src/components/admin/billing/billing-banner.tsx` | Баннер на всех страницах админки: предупреждение до срока, ошибка после срока с датой блокировки. editor баннер не видит |
| Страница оплаты | admin | `/admin/billing`, `frontend/src/components/admin/billing/billing-panel.tsx` | Срок, цена, состояние, кнопка «Оплатити» (переход на страницу Monobank), история платежей. Пункт меню «Оплата» — только при включённом биллинге |
| Подтверждение оплаты | Система | `POST /api/billing/monobank/webhook`, `POST /api/admin/billing/invoices/:id/sync` | Webhook с проверкой подписи, статус перепроверяется в API Monobank; при возврате на страницу оплата перепроверяется ещё раз — на случай потерянного webhook. Срок продлевается на период ровно один раз |
| Блокировка | editor, admin | `src/modules/billing/billing.guard.ts`, `(dashboard)/layout.tsx` | admin видит только страницу оплаты; editor — экран «не оплачено» и выход; API админки отвечает 402; публичный сайт работает |
| Возврат денег | Система | `src/modules/billing/billing.service.ts` | Полный возврат откатывает срок ровно на оплаченный период (позднее оплаченные периоды сохраняются), один раз; частичный возврат ничего не меняет |
| Ручное продление | Вендор | `npm run billing:extend -- <months>` / `billing:extend:prod` | Для оплаты переводом; пишется в аудит |
| Неудачная или брошенная оплата | Система | — | Срок не продлевается; в истории — «Не вдалося» / «Термін минув» / «Очікує оплати» |

## 14. ИИ-обработка фото и пакеты фото

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Редактирование с ИИ | admin, editor (по настройке доступа) | `frontend/src/components/admin/media/photo-ai/photo-ai-workspace.tsx`, `src/modules/photo-ai/*` | Улучшение (свет, баланс белого, шум) или замена окружения; машина не меняется (защита в промпте). 9 встроенных пресетов, свои пресеты до 50, история до 50 вариантов. Перед применением нужно отметить «я проверил авто»; оригинал можно вернуть |
| Ограничения | Система | `PHOTO_AI_JOBS_PER_HOUR`, `PHOTO_AI_TIMEOUT_SECONDS`, `PHOTO_AI_MODEL` | 10 обработок в час на пользователя (по умолчанию), одна активная обработка на фото; платный запрос при таймауте не повторяется |
| Режим «свой ключ» (`own_key`) | admin | `/admin/branding` → настройки ИИ-фото | По умолчанию. Клиент вставляет свой ключ OpenAI (хранится зашифрованным, нужен `PHOTO_AI_ENCRYPTION_KEY`), включает ИИ и выбирает, кто из редакторов может им пользоваться (все / выбранные / только админы). Лимитов пакетов нет |
| Режим «наш ключ» (`managed`) | Вендор (через env), admin | `PHOTO_AI_MODE=managed`, `PHOTO_AI_MANAGED_API_KEY`, `PHOTO_AI_PACK_SIZE`, `PHOTO_AI_PACK_PRICE_UAH`, `PHOTO_AI_FREE_PHOTOS`, `MONOBANK_TOKEN` | Ключ наш, поле ключа в интерфейсе скрыто. Работает независимо от оплаты хостинга |
| Баланс и списание | Система | `src/modules/photo-ai/photo-credits.*` | Фото резервируется при старте обработки и списывается только при успешном результате; при ошибке возвращается. Бесплатные фото начисляются один раз. Неиспользованные фото не сгорают |
| Покупка пакета | admin | `/admin/branding`, `frontend/src/components/admin/branding/photo-pack-panel.tsx`, `/api/admin/photo-ai/credits*` | Кнопка «Купити пакет (N фото — X ₴)» → Monobank; купить можно в любой день; при заблокированном хостинге покупка недоступна. Полный возврат денег снимает фото пакета (баланс может уйти в минус) |
| Баннеры | admin | панель пакетов фото | «Мало фото» — когда осталось ≤ max(5, 10% пакета); «Фото закінчилися» — когда 0. editor видит только «Обробка ШІ недоступна» |
| Пометка на витрине | Посетитель | `listing-card.tsx`, `gallery.tsx`, подпись Telegram | «Фото оброблено ШІ» / «Сцену змінено ШІ» |
