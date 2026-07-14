# Деплой AutoFlow — Hetzner single server

Схема: GitHub Actions собирает два образа (`autoflow-backend`, `autoflow-frontend`),
пушит в Docker Hub и по SSH обновляет compose-стек на сервере.
Caddy терминирует TLS (Let's Encrypt) и маршрутизирует:

```
https://DOMAIN        → frontend (Next.js :3001)
https://DOMAIN/api/*  → app (NestJS :3000)
https://MEDIA_DOMAIN  → MinIO :9000 (фото: публичное чтение + presigned-загрузки)
```

## 1. Разовая подготовка сервера (Hetzner Cloud, Ubuntu 22.04+)

```bash
# Docker + compose-плагин
curl -fsSL https://get.docker.com | sh

# Каталог приложения
mkdir -p /opt/autoflow
cd /opt/autoflow

# Окружение: скопировать deploy/.env.production.example → /opt/autoflow/.env
# и заполнить ВСЕ CHANGE_ME (openssl rand -hex 32 для секретов).
```

DNS: A-записи `DOMAIN` и `MEDIA_DOMAIN` → IP сервера (до первого запуска,
иначе Let's Encrypt не выдаст сертификат).

Firewall: используйте **Hetzner Cloud Firewall** (уровень гипервизора),
открыть только 22 (лучше — со своего IP), 80, 443. Именно Cloud Firewall,
а не только ufw: Docker пишет свои iptables-правила в обход ufw, поэтому
случайно добавленный `ports:` в compose ufw не остановит.

Про SSH-пользователя деплоя: членство в группе `docker` эквивалентно root
(тривиальная эскалация через `docker run --privileged`). Утечка
`DEPLOY_SSH_KEY` = root на сервере — храните только в GitHub Secrets и
ротируйте при смене состава команды.

## 2. Секреты и переменные в GitHub

Settings → Secrets and variables → Actions.

**Secrets:**

| Имя | Что это |
|---|---|
| `DOCKERHUB_USERNAME` | логин Docker Hub |
| `DOCKERHUB_TOKEN` | access token Docker Hub (Read & Write) |
| `DEPLOY_HOST` | IP/хост сервера |
| `DEPLOY_USER` | SSH-пользователь (root или деплой-юзер в группе docker) |
| `DEPLOY_SSH_KEY` | приватный SSH-ключ (без passphrase) |
| `DEPLOY_PORT` | (опционально) SSH-порт, по умолчанию 22 |

**Variables:**

| Имя | Пример |
|---|---|
| `DOMAIN` | `autoflow.example.com` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://autoflow.example.com/api` |
| `NEXT_PUBLIC_MEDIA_HOSTS` | `media.autoflow.example.com` |

`NEXT_PUBLIC_*` вшиваются в клиентский бандл на этапе сборки образа —
смена значения требует пересборки (просто перезапустить деплой).

## 3. Первый деплой

Пуш в `main` (или Actions → Deploy → Run workflow). После успешного прогона:

```bash
# на сервере — сид каталога и админа (пароль берётся из SEED_ADMIN_PASSWORD)
cd /opt/autoflow
docker compose run --rm app npm run seed
```

## 4. Обычный цикл

- Пуш в `main` → CI → Deploy: образы тегаются `latest` + SHA коммита,
  миграции выполняются до переключения контейнеров, затем `up -d`.
- **Откат:** Actions → Deploy → Run workflow → в поле `image_tag` указать SHA
  предыдущего успешного деплоя. Сборка пропускается, разворачивается старый образ.
  (Откат миграций при необходимости: `docker compose run --rm app npx typeorm migration:revert -d dist/src/database/data-source.js`.)

## 5. Диагностика на сервере

```bash
cd /opt/autoflow
docker compose ps
docker compose logs -f app        # API
docker compose logs -f worker     # обработка фото
docker compose logs -f caddy      # TLS/маршрутизация
```

## Замечания

- Постоянные данные живут в named volumes: `pg_data`, `minio_data`, `redis_data`,
  `caddy_data`. Бэкапы: `docker compose exec postgres pg_dump ...` + снапшоты
  тома MinIO (или Hetzner volume snapshots).
- Приложение в проде откажется стартовать с плейсхолдер-секретами или
  `minioadmin` — это встроенная проверка env.
- `TRUST_PROXY=1` обязателен: без него rate limiting видит IP Caddy, а не клиента.
- **Миграции должны быть expand-only** (добавление таблиц/колонок с дефолтами).
  Деплой запускает миграции на новом образе, пока старый app ещё обслуживает
  трафик — ренейм/дроп колонки уронит старую версию на эти секунды. Дроп
  делайте отдельным релизом после того, как код перестал читать колонку.
- Скрипты `postgres-init/` выполняются только при первичной инициализации
  тома `pg_data`. Правка скрипта на существующей базе ничего не изменит —
  выполняйте SQL вручную: `docker compose exec postgres psql -U $DB_ADMIN_USER -d $DB_NAME`.
