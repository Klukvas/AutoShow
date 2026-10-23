#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/context.sh" "${1:-}" "${2:-}"
lock_installation
helper_image=$(value BACKUP_HELPER_IMAGE "$bundle/dependencies.env")
docker image inspect "$helper_image" >/dev/null 2>&1 || fail 'approved backup helper digest must be preloaded'
setdir=${3:-}
[[ -f "$root/RESTORE_ISOLATED" && -d "$setdir" ]] || fail 'RESTORE_ISOLATED marker and decrypted backup directory required'
[[ "$(cat "$setdir/installation-id")" != "$id" ]] || fail 'restore drill must have a different installation identity'
[[ ! -f current-release ]] || fail 'restore requires a fresh isolated target'
[[ "$(cat "$setdir/app-role")" = "$(value DB_APP_USER .env)" ]] || fail 'use the same app role name for ACL restore'
python3 "$bundle/bin/validate-backup.py" "$setdir"
# Caller must keep this stack on a host/firewall without outbound connectivity.
# Never start frontend/app/worker or replay queued notifications during the drill.
# Require unused volume names, so extraction never overlays another dataset.
project=$(value COMPOSE_PROJECT_NAME .env)
for volume in pg_data minio_data redis_data; do
  if docker volume inspect "${project}_$volume" >/dev/null 2>&1; then fail 'restore target volumes already exist'; fi
done
compose up -d --pull never postgres redis minio minio-init
runtime_check infra "$root" "$release"
count=$(compose exec -T postgres sh -c 'psql -At -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = '\''public'\''"')
[[ "$count" = 0 ]] || fail 'target database is not empty'
compose exec -T postgres sh -c 'exec pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$setdir/database.dump"
compose stop minio minio-init
container=$(compose ps -aq minio)
docker run --rm -i --network none --volumes-from "$container" "$helper_image" tar -C /data -xf - < "$setdir/minio.tar"
compose up -d --wait minio
compose up -d minio-init
restored=$(compose exec -T postgres sh -c 'psql -At -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT count(*) FROM typeorm_migrations"')
[[ "$restored" = "$(cat "$setdir/migration-count")" ]] || fail 'restored schema verification failed'
echo "Isolated DB+media restored for $id; verify representative rows and media checksums before any recovery cutover. Worker remains stopped."
