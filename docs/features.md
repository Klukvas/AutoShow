# AutoFlow — карта фич

Документ нужен для быстрой продуктовой и бизнес-ориентации: какие фичи есть, кто ими
пользуется, где они видны (UI/API) и какие у них ключевые ограничения.

Обновлено: 2026-10-14.

Ссылки на источники — это пути в репозитории (ориентир, где искать), а не построчная
документация кода. Фичи, реализованные частично или отсутствующие, помечены явно —
см. раздел 12.

---

## 1. Роли и доступ

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публичный доступ без авторизации | Посетитель сайта | Витрина `/cars`, `/cars/[slug]`, публичные формы заявок; `frontend/src/app/(public)`, `src/modules/listings/listings-public.controller.ts`, `src/modules/leads/leads-public.controller.ts` | Доступа в админку нет вообще; публичные эндпоинты отдают только опубликованные данные |
| Роль `editor` | Контент-менеджер | Админка: объявления (CRUD, статусы, медиа, ручной пост в Telegram), лиды (список, статусы, заметки), создание марки/модели «на лету»; `frontend/src/app/(admin)/admin/(dashboard)/layout.tsx`, `src/modules/listings/listings-admin.controller.ts`, `src/modules/leads/leads-admin.controller.ts` | Нет доступа к команде, отзывам, аудиту и аналитике — разделы скрыты в меню и закрыты на бэкенде; брендинг править нельзя (нет UI и прав на запись), но урезанная версия брендинга доступна на чтение — без секретов Telegram (`botToken`, `leadChatId`) |
| Роль `admin` | Владелец / руководитель | Полный доступ: брендинг и Telegram-токен, команда, отзывы, аудит, аналитика, каталог, теги, коллекции; `src/modules/branding`, `src/modules/admin-users`, `src/modules/audit`, `src/modules/analytics` | Единственная роль, видящая секреты Telegram и журнал аудита |
| Авторизация и сессии | Сотрудники админки | `login` / `refresh` / `logout` / `me`; `src/modules/auth/*`, `frontend/src/app/(admin)/admin/login/page.tsx` | JWT access-токен + refresh-токен с ротацией в Redis; повторное использование старого refresh отзывает сессию (replay revoke) |

## 2. Публичная витрина

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Главная страница | Посетитель | `frontend/src/app/(public)/page.tsx`, `src/modules/analytics/stats-public.controller.ts` | Hero, подборки, отзывы, блок доверия со статистикой; статистика считается по публичным данным |
| Каталог `/cars` | Посетитель | `frontend/src/app/(public)/cars/page.tsx`, `src/modules/listings/listings-public.controller.ts` | Фильтры: марка, модель, кузов, топливо, коробка, привод, состояние, город, цена, год, пробег, опции, теги, поиск `q`; сортировка и курсорная пагинация (не offset) |
| Карточка объявления в списке | Посетитель | `frontend/src/components/listing/listing-card.tsx` | Медиа, цена, статус, теги, пометка снижения цены |
| Страница автомобиля `/cars/[slug]` | Посетитель | `frontend/src/app/(public)/cars/[slug]/page.tsx`, `frontend/src/components/listing/*` | Галерея, характеристики, опции, похожие автомобили, шаринг, мобильный CTA, формы заявок |
| Избранное и сравнение | Посетитель | `frontend/src/app/(public)/favorites/page.tsx`, `frontend/src/app/(public)/compare/page.tsx` | Списки хранятся на клиенте (без аккаунта), страницы вычищают удалённые и снятые с публикации автомобили |
| Статические и маркетинговые страницы | Посетитель | `frontend/src/app/(public)/about/page.tsx`, `frontend/src/app/(public)/contacts/page.tsx`, `frontend/src/app/(public)/collections/[key]/page.tsx` | Контакты и тексты берутся из брендинга; коллекции — отдельные лендинги по ключу |

## 3. Объявления / автомобили в админке

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Добавление автомобиля | editor, admin | `frontend/src/components/admin/listings/listing-form.tsx`, `src/modules/listings/listings.service.ts` | Создаётся черновик: генерируется slug, валидируются справочники каталога, цена нормализуется по курсу, пишется базовая точка истории цены, в аудит идёт `listing.create` |
| Редактирование | editor, admin | `PATCH` объявления; `src/modules/listings/listings.service.ts` | Оптимистичная блокировка по версии (конфликт при параллельном редактировании); проданные объявления только на чтение; изменение цены пишет историю и поля снижения цены |
| Удаление | editor, admin | `src/modules/listings/listings.service.ts` | Мягкое удаление объявления, медиа и рендишенов; событие `listing.delete` в аудите |
| Список и поиск в админке | editor, admin | `frontend/src/app/(admin)/admin/(dashboard)/listings/page.tsx`, `frontend/src/components/admin/listings/listings-table.tsx` | Фильтр по статусу и поиск `q`, курсорная пагинация, таблица с тулбаром действий |
| Переходы статусов | editor, admin | `src/modules/listings/listings-admin.controller.ts`, `frontend/src/components/admin/listings/transition-menu.tsx` | Публикация, архивация, бронь и снятие брони, отметка о продаже; массовые операции: публикация, архивация, удаление |
| Готовность к публикации | editor, admin | `src/modules/listings/listings.service.ts` | Нужно хотя бы одно фото в статусе `ready`; VIN обязателен, если включён `vinVisible`; комиссионные поля должны быть валидны; при повторной публикации первый `publishedAt` сохраняется |
| Отметка «продано» | editor, admin | `src/modules/listings/listings.service.ts` | Проставляются `soldAt`, `salePriceAmount`, `commissionAmount`; если не задана ставка комиссии — ответ 422 |
| Комиссионные / клиентские автомобили | editor, admin | `src/modules/listings/dto/create-listing.dto.ts`, `src/modules/listings/entities/listing.entity.ts` | Для `sellerType = client` обязателен `sellerPhone`; при `feeType` percent/fixed обязательна ставка; комиссия считается в момент продажи |

## 4. Медиа

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Загрузка через presigned URL | editor, admin | `src/modules/media/media.service.ts`, `frontend/src/components/admin/media/media-manager.tsx` | Сервер создаёт запись `pending` и PUT-ссылку, клиент грузит файл напрямую в S3, затем confirm проверяет наличие объекта |
| Обработка изображений | Система (воркер) | `src/workers/media-processor.worker.ts` | Генерируются рендишены thumb/gallery/full в webp/avif/jpeg; статус медиа становится `ready` или `failed` |
| Видео | editor, admin | `src/modules/media/media.service.ts` | Confirm может помечать видео как `ready` без рендишенов изображений |
| Менеджер медиа | editor, admin | `frontend/src/components/admin/media/*` | Обложка, порядок, удаление, повтор обработки для `failed`; причина сбоя (`failure_reason`) видна в интерфейсе |
| Очистка мусора | Система (воркер) | `src/workers/maintenance.worker.ts` | Удаляет застрявшие `pending` и старые `failed` записи вместе с объектами в S3 |

## 5. Лиды и CRM

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публичные формы заявок | Посетитель | `src/modules/leads/leads-public.controller.ts`, `frontend/src/components/listing/contact-panel.tsx`, `frontend/src/components/listing/credit-calculator.tsx` | Типы: `callback`, `message`, `test_drive`, `sell_request`, `credit`; honeypot-спам обрабатывается как no-op (посетитель видит успех, лид не создаётся); есть рейт-лимит |
| Структурированные детали заявки | Менеджер | `src/modules/leads/entities/lead.entity.ts`, `src/modules/leads/leads.service.ts` | Данные по продаже и кредиту пишутся в JSON-поле `Lead.details` — схема не реляционная, валидируется на входе |
| Входящие и CRM | editor, admin | `frontend/src/app/(admin)/admin/(dashboard)/leads/page.tsx`, `frontend/src/components/admin/leads/*` | Список лидов, статусы `new` / `in_progress` / `done` / `spam`, заметки, CRM-панель |
| Живое уведомление в админке | editor, admin | `frontend/src/components/admin/leads/lead-live-notifier.tsx`, `frontend/src/lib/admin/lead-watch.ts` | Поллинг + тост о новых лидах; это не вебсокеты, задержка равна интервалу опроса |
| Алерты по лидам | Менеджер (Telegram) | `src/modules/notifications/*`, `src/modules/leads/leads.service.ts` | Реальные лиды ставят задачу на Telegram-алерт менеджеру; сбой постановки в очередь не ломает ответ посетителю (ошибка логируется) |

## 6. Telegram и уведомления

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Публикация объявлений в канал | admin (настройка) | `frontend/src/components/admin/branding/branding-editor.tsx`, `src/modules/branding/entities/site-settings.entity.ts` | Раздел «Брендинг → Telegram»: токен бота, список каналов, флаг `autoPublish` |
| Автопостинг | Система | `src/modules/listings/listings.service.ts`, `src/modules/telegram/*` | Первая публикация ставит задачу в очередь Telegram; дубликаты невозможны — уникальность `ListingTelegramPost` по паре объявление/чат |
| Ручной пост | editor, admin | `frontend/src/components/admin/listings/telegram-post-panel.tsx`, `src/modules/telegram/telegram-admin.controller.ts` | Панель в карточке объявления отправляет только в те каналы, где поста ещё нет |
| Формат поста | Подписчик канала | `src/modules/telegram/telegram-caption.ts`, `src/workers/telegram.worker.ts` | Альбом до 10 фото, подпись с характеристиками, ценой и ссылкой на сайт; при отметке «продано» подпись редактируется на SOLD |
| Уведомления о лидах | Менеджер | `src/modules/notifications/telegram-channel.ts` | Тот же токен бота, но отдельный чат менеджера (`leadChatId`) |
| Безопасность и лимиты | admin | `src/modules/branding/branding.service.ts`, `src/modules/telegram/telegram-api.client.ts` | `botToken` и `leadChatId` не отдаются публично и не видны роли `editor`, в аудите маскируются; ссылки на медиа должны быть публично доступны, иначе Telegram не заберёт файлы |

## 7. Брендинг и настройки сайта

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| `SiteSettings` | admin | `src/modules/branding/entities/site-settings.entity.ts` | Логотип и favicon, цвета, отображаемое название и слоган, контакты, адрес, часы работы, соцсети, SEO-дефолты, `defaultCurrency`, конфигурация Telegram |
| Публичный брендинг | Посетитель | `src/modules/branding/branding-public.controller.ts` | Публичный эндпоинт отдаёт настройки без секретов Telegram |
| Редактор брендинга | admin (правка), editor (чтение) | `frontend/src/app/(admin)/admin/(dashboard)/branding/page.tsx`, `src/modules/branding/branding-admin.controller.ts` | admin правит брендинг, SEO, валюту и Telegram; editor получает урезанную версию только на чтение |
| Смена базовой валюты | admin | `src/modules/branding/branding.service.ts` | Перенормализует цены всех объявлений и сбрасывает предыдущую базу для расчёта снижения цены — операция массовая, выполнять осознанно |

## 8. Каталог, теги и коллекции

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Справочники каталога | Посетитель (чтение), admin (управление) | `src/modules/catalog/*` | Марки, модели, кузова, топливо, коробки, приводы, цвета, опции; публичное чтение и админское управление |
| Создание марки/модели «на лету» | editor, admin | `frontend/src/components/admin/listings/catalog-combobox.tsx` | Можно создать марку или модель прямо из формы объявления, не уходя в раздел каталога |
| Логотипы марок | Система | `src/modules/catalog/make-logo.service.ts`, `src/workers/maintenance.worker.ts` | Логотип генерируется/забирается через simple-icons и jsDelivr и складывается в S3; при неудаче maintenance-воркер повторяет попытку (внешняя зависимость) |
| Теги | Посетитель (бейджи и фильтры), admin | `src/modules/catalog/entities/tag.entity.ts`, `frontend/src/app/(admin)/admin/(dashboard)/tags/page.tsx` | Теги видны на карточках и участвуют в фильтрации каталога |
| Коллекции | Посетитель, admin | `src/modules/collections/*`, `frontend/src/app/(admin)/admin/(dashboard)/collections/page.tsx` | Кураторские SEO/маркетинговые лендинги по ключу с сохранёнными фильтрами |

## 9. Отзывы, команда, аудит, аналитика

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Отзывы | Посетитель (чтение), admin | `src/modules/reviews/*`, `frontend/src/app/(admin)/admin/(dashboard)/reviews/page.tsx` | Публично видны только опубликованные отзывы; модерация — в админском менеджере |
| Команда / пользователи админки | admin | `src/modules/admin-users/*`, `frontend/src/app/(admin)/admin/(dashboard)/team/page.tsx` | admin создаёт и ведёт аккаунты редакторов |
| Журнал аудита | admin | `src/modules/audit/*`, `frontend/src/app/(admin)/admin/(dashboard)/audit/page.tsx` | Фиксирует важные действия по объявлениям, медиа, брендингу, пользователям, Telegram и лидам; фильтры доступны только admin |
| Аналитика | admin | `src/modules/analytics/*`, `frontend/src/app/(admin)/admin/(dashboard)/page.tsx` | Дашборд: сводные карточки, последние объявления и лиды; только для admin |

## 10. SEO и фоновые процессы

| Фича | Кто пользуется | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| SEO-разметка объявлений | Поисковые системы | `frontend/src/app/(public)/cars/[slug]/page.tsx` | Метаданные, canonical, JSON-LD на публичных страницах автомобилей |
| Sitemap и `llms.txt` | Поисковые системы, LLM-краулеры | `src/modules/sitemap/*`, `frontend/src/app/llms.txt/route.ts` | Sitemap собирается на бэкенде, `llms.txt` отдаёт фронтенд-роут |
| Счётчик просмотров | Посетитель (неявно), admin (отчёты) | `src/modules/views/*`, `src/workers/views-flush.worker.ts` | Дедупликация и `HINCRBY` в Redis, периодический сброс в `listings.views_count` — значение в БД отстаёт на интервал флаша |
| Воркеры | Система | `src/workers/*` | Медиа, Telegram, уведомления, просмотры, обслуживание; без запущенных воркеров очереди копятся |
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
| Docker + Caddy | Разработчик / деплой | `docker-compose.yml`, `deploy/*` | Прод разворачивается через Compose, TLS и проксирование — на Caddy |
| Swagger | Разработчик | `/api/docs` | Документация API бэкенда |

## 12. Не реализовано / частично реализовано

| Фича | Статус | Где в UI/API | Что важно / ограничения |
| --- | --- | --- | --- |
| Бронирование и оплата | Частично (только модель данных) | Сущность `Reservation` и миграция есть | Реального флоу брони и платежей нет; статус `reserved` у объявления выставляется вручную |
| Импорт из фидов / парсер | Не реализовано | Поле `sourceType` присутствует | Сам процесс импорта отсутствует — поле заполняется вручную |
| Внешний провайдер курсов и автообновление | Не реализовано | — | Используются только статические курсы `FX_STATIC_*` из окружения |
| Email-уведомления о лидах | Удалено осознанно | — | Алерты по лидам идут только в Telegram; email-канал убран из кодовой базы |
| Полноценный CRM / воронка сделок | Частично | Статусы и заметки лида | Нет этапов сделки, задач и напоминаний — только статусы `new`/`in_progress`/`done`/`spam` и заметки |
| Telegram и локальные медиа | Ограничение окружения | `src/modules/telegram/telegram-api.client.ts` | Локальные URL MinIO недостижимы для Telegram, поэтому в dev посты с фото могут падать |
