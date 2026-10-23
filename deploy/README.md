# Независимые установки AutoFlow

Один автосалон — один сервер, compose project, PostgreSQL, Redis, MinIO,
домены, секреты и резервные копии. Общий код backend/frontend остаётся в этом
репозитории. Нет tenant_id, общей базы, форков или постоянных клиентских веток.
Обновление одной установки не обновляет остальные.

## Конфигурация и границы

| Источник | Что хранит | Как применять |
| --- | --- | --- |
| `/opt/autoflow/.env` на конкретном сервере | installation ID, стабильное compose-имя, домены, theme/font, flags, интеграции, тарифы, лимиты и секреты | перезапуск соответствующих app/worker/frontend/Caddy |
| Версионный `releases/BUNDLE/release.env` | backend/frontend **image digests**, source/version | явно выбрать bundle и выполнить update/rollback |
| `site_settings` в локальной БД, обычная админка | название, логотип, контакты, цвета, SEO, валюта, часы работы; существующие настройки Telegram/AI | сохранение в админке, storefront fetch cache до 300 секунд |
| GitHub Environment `installation-ID` | SSH именно этого сервера; media allowlist для сборки frontend | новая сборка frontend при смене media origin |

`INSTALLATION_ID` обозначает установку, не является разграничением строк в БД.
Данные разделены отдельными серверами/хранилищами. Не направляйте две установки
на одну БД, Redis или bucket и не копируйте секреты между клиентами.

Публичный `GET /api/installation` возвращает только
`installationId`, `themeId`, `fontPreset`, `features.reviews`.
Операторские домены, соединения, лимиты, ключи и цены туда не попадают.
`GET /api/branding` использует явный список публичных полей.
`PATCH /api/admin/branding` не меняет операторскую конфигурацию.

`FEATURE_REVIEWS=true` сохраняет прежнее поведение. `false` скрывает отзывы на
главной, ссылку в админке и прямую страницу `/admin/reviews`; backend возвращает
404 на публичный GET и авторизованные admin GET/POST/PATCH/DELETE. Роли и
проверка оплаты продолжают действовать независимо: feature flag не даёт права
доступа. Неизвестные theme/font и нестрогие boolean отклоняются при запуске.

Витрина использует те же API, типы, фильтры и бизнес-логику для всех тем.
`STOREFRONT_THEME=current`, `STOREFRONT_FONT_PRESET=default` сохраняют дизайн;
`compact` и `system` — минимальная проверочная вариация отступов/шрифта в публичном
поддереве. Админка не переоформляется. Новые темы добавляются в presentation
selector/CSS и разрешённый enum, без копирования бизнес-логики или страниц.
Брендовые цвета/логотипы редактируются существующим механизмом branding.

## Новая установка без исходников на сервере

1. Подготовить отдельный сервер (Docker Engine + Compose v2, Python 3.10+,
   `sha256sum`, Linux `flock` (util-linux); для backup также `age`, `rsync`, SSH). Docker сам не устанавливается.
   Открыть только SSH, 80/443; 8081 нужен только в режиме HTTP по IP. PostgreSQL,
   Redis и MinIO API/console не публикуются на host. Пользователь Docker имеет
   полномочия уровня root; SSH-ключ хранить только в GitHub Secrets.
2. Настроить DNS сайта и media на этот сервер. Domain mode:
   `SITE_ADDRESS=dealer.example`, `MEDIA_ADDRESS=media.dealer.example`;
   `PUBLIC_URL`/`PUBLIC_SITE_URL`/`CORS_ORIGINS=https://dealer.example`,
   `S3_ENDPOINT=https://media.dealer.example`,
   `S3_PUBLIC_URL=https://media.dealer.example/autoflow`.
   HTTP по IP: явный `http://IP`, media `http://IP:8081`, cookie secure=false.
   Production bundle поддерживает `API_PREFIX=api`, `TRUST_PROXY=1` за Caddy.
3. Создать `/opt/autoflow/.env` из [шаблона](.env.production.example), права 0600.
   Задать уникальный `INSTALLATION_ID`, `COMPOSE_PROJECT_NAME=autoflow-ID` и
   заполнить пустые секретные поля в защищённом операторском процессе.
   Поддерживаемая dotenv-грамматика: только `UPPER_CASE_KEY=value`, без `export`,
   пробелов вокруг ключа/`=`, повторов, interpolation или inline comments.
   Для literal значений с пробелами, `$`, `#` и glob-символами использовать
   одинарные кавычки (одна строка, без внутренних одинарных кавычек и обратных
   слешей; escape-последовательности не поддерживаются).
   Валидатор и runtime используют один parser; Compose получает те же значения. Известные
   JWT/MinIO defaults production не принимает. Не выводить файл/секреты в логи.
   Master key `PHOTO_AI_ENCRYPTION_KEY` — 32 случайных байта в base64; сохранить
   вместе с остальными recovery secrets отдельно в защищённом vault.
4. В GitHub создать Environment `installation-ID`, включить approval protection.
   Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, optional `DEPLOY_PORT`,
   а также Docker Hub `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` (registry можно держать
   на уровне repo). Variable `NEXT_PUBLIC_MEDIA_HOSTS` — точные разрешённые media
   hostname/origin, включая все media/CDN hosts, реально возвращаемые API.
   Variables `CADDY_IMAGE`, `POSTGRES_IMAGE`, `REDIS_IMAGE`, `MINIO_IMAGE`,
   `MINIO_CLIENT_IMAGE`, `BACKUP_HELPER_IMAGE` — только полные `repo@sha256:…`.
   Эти шесть approved pins должны **точно совпадать** с операторским `.env`;
   Release копирует их в immutable `dependencies.env`. Пустые/mutable pins
   отклоняются. Перед rollout явно предзагрузить эти approved digest images
   на выбранный сервер; app rollout тянет только app/worker/frontend, не меняет
   dependency images. Новый сервер тоже получает явный approved dependency set.
5. Запустить **Release installation images** на нужном source ref с ID установки.
   Он проверяет код, собирает общий backend и frontend этого source с выбранной
   media allowlist, публикует digests и сохраняет artifact
   `release-ID-SOURCE_SHA-RUN_ID`. Это не деплой. Скачать и хранить этот bundle
   вне срока хранения Actions artifacts; он содержит compose/Caddy/init/scripts,
   версии, dependency pins и checksum manifest, без исходников и `.env`.
6. Запустить **Deploy selected installation**: тот же ID, full source SHA,
   Release run ID, operation `bootstrap`. Он копирует только соответствующий
   bundle в `/opt/autoflow/releases/SHA-ID-RUN_ID`, запускает зависимости,
   миграции и production seed (без demo машин), затем app/worker/frontend/Caddy.
   Админ создаётся из локальных `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
   Автоматического создания или перезаписывания секретов нет.

Для локального операторского применения скачанного bundle:

```bash
bash /opt/autoflow/releases/BUNDLE/bin/installation.sh validate /opt/autoflow BUNDLE
bash /opt/autoflow/releases/BUNDLE/bin/installation.sh bootstrap /opt/autoflow BUNDLE
```

Caddy обслуживает same-origin `/api/*` и SEO файлы, Next получает внутренний
`BACKEND_INTERNAL_URL=http://app:3000/api`. В Next dev `/api` проксируется на
локальный backend. Браузерные API-вызовы и catalog logo upload не содержат
вшитого клиентского домена.

**Frontend image привязан к media origin.** CSP и `next/image.remotePatterns`
Next standalone фиксируются на этапе сборки. Один frontend digest нельзя
переносить между произвольными media hosts. При смене host соберите новый bundle
из того же общего source, задайте новый S3 origin в `.env` и примените его.
Source SHA + run ID различают такие варианты; backend и frontend pins хранятся
раздельно. Нет wildcard remote host/CSP. Смена theme/flag требует только restart,
смена branding — save, смена media allowlist — build + update. Изменение только
домена сайта при неизменном media host требует пересоздания Caddy/app/frontend,
обновления site URLs/CORS/cookie; frontend rebuild не нужен.

## Переход существующего сервера

Сначала backup и read-only инвентаризация `docker compose ls`, volumes, текущих
image IDs, repo digests, `.env` и schema version. Для существующего MinIO
сохранить **точный текущий совместимый image digest** (также его client/helper).
Нет автоматического перехода September 2025 → May 2025 или иной смены storage
версии. Fresh test stacks с May 2025 не доказывают совместимость существующих
volumes с downgrade. Смена зависимости — отдельное явно согласованное обновление,
с backup и isolated compatibility drill; не подменять старые pins новым default. Прежний `/opt/autoflow` обычно имеет compose
project **autoflow**: задайте **COMPOSE_PROJECT_NAME=autoflow**, чтобы сохранить
`autoflow_pg_data`, `autoflow_minio_data` и остальные существующие volumes.
Не выбирайте новое имя для существующих данных. Задайте installation ID,
theme/default flag, заполните недостающие операторские ключи без ротации текущих.
Подготовьте и сохраните legacy rollback bundle с точными старыми images/compose
до первого перехода. Первый bootstrap нового tooling допускается только после
проверки имён volumes; SQL seed идемпотентен. Не удаляйте существующие volumes.
После успешного применения `installation-identity` фиксирует ID+compose project;
update/rollback отвергает незапланированную смену этой пары.

## Версии, обновление и откат

Push/main запускает проверки, не деплой всех клиентов. Выбирайте установки по
одной: сначала backup, затем Release, затем Deploy `update`, smoke/readiness и
проверка админки/загрузки фото; только после этого следующий салон. Это ручное
операторское решение, не автоматический fleet rollout.

```bash
bash /opt/autoflow/releases/NEW/bin/installation.sh update /opt/autoflow NEW
bash /opt/autoflow/releases/OLD/bin/installation.sh rollback /opt/autoflow OLD
```

Каждый bundle содержит application и **все dependency/helper digests**, source SHA, media origins и совместимые с ним
compose/Caddy/init/scripts; rollback использует **старый bundle целиком**, а не
старый image с текущими файлами репозитория. Перед rollback оператор восстанавливает согласованные dependency pins в `.env`
и проверяет совместимость schema и текущих `.env`/media origins со старой версией. Никакого
`latest`, automatic schema down, image prune или ротации секретов нет.
Миграции запускаются только bootstrap/update на новом image до переключения app;
они обязаны сохранять совместимость со старым app (expand-first). Для этой задачи
**новой миграции нет**: controls находятся в env, branding singleton прежний.

`current-release` обновляется только после dependency health + успешного
`minio-init`, API/frontend ответов **через Caddy**, ожидаемой frontend version и
двух стабильных проверок actual app/worker/frontend/Caddy images/config/restart counts; `previous-release`
сохраняет прошлый pointer. При неудаче сервисы могли уже переключиться: старый
pointer не обещает автоматический откат. Оператор проверяет состояние и явно
применяет старый bundle. Возврат app не отменяет миграции. Несовместимый rollback
требует планируемого восстановления проверенной DB+media копии с потерей более
новых записей; не запускать `migration:revert` на реальных данных автоматически.

## DB + media backup и изолированное восстановление

```bash
bash /opt/autoflow/releases/BUNDLE/bin/backup.sh /opt/autoflow BUNDLE AGE_PUBLIC_RECIPIENT backup@backup-host:/srv/backups/dealer-id
```

Все local bootstrap/update/rollback/snapshot/restore используют один
`ROOT/.operation.lock` (`flock -n`) до завершения/recovery resume. Конкурирующая
операция сразу отклоняется; GitHub concurrency не заменяет этот local lock.
Backup wrapper не держит внешний lock при вызове snapshot (нет nested deadlock).

`backup.sh` требует существующий running bundle и доверенный SSH host key.
`snapshot.sh` не доверяет одному `current-release`: до остановки/dump сверяет
actual container image IDs с локально разрешёнными pinned digest IDs и Compose
config hashes **всех** app/worker/frontend/Caddy/Postgres/Redis/MinIO/init. При
расхождении после failed update — отказ без stop/dump. Он проверяет running state,
останавливает приём записей и worker, создаёт custom PostgreSQL dump с schema
metadata, делает Redis SAVE, останавливает MinIO+Redis и снимает холодные архивы.
После полного checksummed набора запускает **точно прежние container IDs**
через `docker start`, без `compose up`, pull или recreate. Это не может незаметно
восстановить image старого pointer вместо реально работавшего image. На время копии
планируется maintenance window; не должно быть сторонних писателей в БД/S3.
При ошибке trap пытается вернуть сервисы; оператор проверяет readiness. Незавершённая
папка не считается backup. `backup.sh` шифрует набор `age` и передаёт только
шифротекст offserver; marker offserver обновляется только после успешного rsync.
Retention и удаление старых копий — отдельное явное операторское действие.

Отдельно зашифрованно хранить `.env`, AI master key, signing/JWT keys, DB/MinIO
credentials, домены и соответствующий release bundle. DB dump содержит Telegram
credentials и зашифрованные provider keys: его нельзя публиковать. Без исходного
AI master key сохранённые provider keys не расшифруются; не заменять master key
новым при recovery. Не включать заполненный `.env` в Actions artifact/логи.

Регулярный drill: подготовить **другой** isolated root/сервер с новым ID и новым
compose project, свежими volumes, loopback-only портами и заблокированным outbound.
Не использовать production DNS, provider callbacks или production runtime credentials.
Из доверенной encrypted копии расшифровать в защищённую папку, проверить checksum.
Подготовить для этого isolated ID совместимый bundle/проверочный media origin.
Для восстановления ACL имя `DB_APP_USER` должно совпадать с исходным (пароль свой).
Создать пустой файл `RESTORE_ISOLATED` в isolated root.

```bash
bash /isolated/releases/BUNDLE/bin/restore-isolated.sh /isolated BUNDLE /isolated/decrypted-set
```

Скрипт требует fresh volumes/empty DB, проверяет полный manifest и безопасные tar
paths и только regular-file/directory types (никаких links/FIFO/devices), восстанавливает DB и **при остановленном MinIO** media, затем поднимает
только зависимости. Сравнить migration count, реальные бизнес-записи (например
отзыв/объявление), количество/метаданные media и checksum скачанного representative
объекта с источником. Проверить вход администратора только при контролируемом
локальном запуске с отключённым outbound. Worker/frontend/app автоматически не
запускаются, реальные уведомления и provider jobs не отправляются.

Redis archive — recovery material для отдельного контролируемого анализа очередей;
**drill его не восстанавливает** и не воспроизводит задачи с внешними побочными
эффектами. При реальном recovery сначала решить, какие jobs безопасно повторить,
согласовать дубликаты и восстановить очереди отдельно. Никогда не распаковывать
raw MinIO/Redis архивы в работающий storage process. Drill не является разрешением
перезаписывать production: cutover требует отдельного операторского решения.

## Диагностика и минимальный мониторинг

- `GET /api/health` — process liveness; `/api/health/ready` — 200 либо 503 без
  connection errors/секретов. Проверяет отдельным bounded подключением БД,
  Redis, S3 bucket, worker heartbeat с **тем же app release**, free disk app FS.
- `GET /api/admin/installation` — admin Bearer token, installation/theme/flags,
  app version и sanitized checks. Доступно при billing block; editor не допускается.
- `GET /health/frontend` — публичная non-sensitive runtime frontend version для ingress gate.
- `/admin/api/installation` — admin session, frontend version + backend diagnostics.
  В логах app/worker есть `installationId`/`appVersion`.
- `bin/installation.sh status ROOT BUNDLE` — compose processes + readiness.
- `bin/monitor.sh ROOT BUNDLE [MAX_BACKUP_AGE_HOURS=30]` — nonzero при readiness
  failure, несовпадении/stale worker (TTL 90s), host disk <2 GiB, отсутствующем или
  просроченном local/offserver marker. Минимум app disk задаёт HEALTH_MIN_FREE_MB.
  Проверяйте data filesystem MinIO/Postgres дополнительно, если они на отдельных
  mount points. Контролировать backup-host receipt/restore drill независимо от
  локального marker; rsync success не заменяет проверку восстановления.

Поставить backup ежедневно и monitor каждые 5 минут в существующей операторской
системе с alert на nonzero exit; это не создаётся автоматически данным изменением.
Следить также за restart count/log errors worker, зависшими jobs и последним
успешным restore drill. Не требуется сложная управляющая multi-tenant платформа.
