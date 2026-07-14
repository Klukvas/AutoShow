#!/usr/bin/env bash
set -e

# Create the runtime role used by the application:
#   app_user — low-privilege role used by the HTTP app and workers.
# Migrations/seeds run as the database owner (POSTGRES_USER).
#
# Password comes from env vars wired in docker-compose. If unset, a sensible
# default is used — replace before any non-dev deployment.

APP_USER="${DB_APP_USER:-app_user}"
APP_PASSWORD="${DB_APP_PASSWORD:-app_change_me}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_USER}') THEN
        CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';
      END IF;
    END \$\$;

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_USER};
    GRANT USAGE ON SCHEMA public TO ${APP_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
EOSQL
