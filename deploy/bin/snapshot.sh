#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/context.sh" "${1:-}" "${2:-}"
lock_installation
helper_image=$(value BACKUP_HELPER_IMAGE "$bundle/dependencies.env")
docker image inspect "$helper_image" >/dev/null 2>&1 || fail 'approved backup helper digest must be preloaded'
stamp=${3:-}
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail 'unique UTC snapshot timestamp required'
[[ "$(cat current-release)" = "$release" ]] || fail 'snapshot must match running release'
umask 077
setdir="$root/backups/$stamp"
[[ ! -e "$setdir" ]] || fail 'snapshot already exists'
# Pointer alone is not proof: a failed update may already have switched services.
# Verify actual digest IDs AND Compose config hashes before any stop/dump.
original=$(runtime_check running "$root" "$release")
container_id() { printf '%s' "$original" | python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]]["id"])' "$1"; }
app_id=$(container_id app); worker_id=$(container_id worker); frontend_id=$(container_id frontend)
minio_id=$(container_id minio); redis_id=$(container_id redis)
mkdir -p "$setdir" "$root/status"
# One consistent DB+media+queue set. Admission stops before the worker drains.
# In-flight requests/worker jobs are stopped before snapshots are captured.
resume() { printf '%s' "$original" | runtime_check resume; }
trap resume EXIT
docker stop "$frontend_id" "$app_id" "$worker_id" >/dev/null
compose exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$setdir/database.dump"
compose exec -T postgres sh -c 'exec psql -At -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT count(*) FROM typeorm_migrations"' > "$setdir/migration-count"
compose exec -T redis redis-cli SAVE >/dev/null
docker stop "$minio_id" "$redis_id" >/dev/null
for service in minio redis; do
  container=$(container_id "$service")
  [[ -n "$container" ]] || fail "$service container missing"
  docker run --rm --network none --volumes-from "$container:ro" "$helper_image" tar -C /data -cf - . > "$setdir/$service.tar"
done
cp "$bundle/release.env" "$setdir/release.env"
printf '%s\n' "$id" > "$setdir/installation-id"
printf '%s\n' "$release" > "$setdir/release-bundle"
printf '%s\n' "$(value DB_APP_USER .env)" > "$setdir/app-role"
(cd "$setdir" && sha256sum database.dump minio.tar redis.tar release.env migration-count installation-id release-bundle app-role > SHA256SUMS)
resume
trap - EXIT
printf '%s\n' "$stamp" > "$root/status/last-local-backup"
