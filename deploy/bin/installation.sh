#!/usr/bin/env bash
set -euo pipefail
operation=${1:-}
source "$(dirname "$0")/context.sh" "${2:-}" "${3:-}"
case "$operation" in
  validate) compose config --quiet ;;
  bootstrap|update|rollback)
    lock_installation
    compose config --quiet
    if [[ "$operation" = bootstrap ]]; then
      [[ ! -e current-release ]] || fail 'already initialized; use update'
    else
      [[ -f current-release ]] || fail 'bootstrap this installation first'
    fi
    # Dependencies are separately approved/preloaded digests, never silently pulled
    # or upgraded/downgraded as part of an application rollout.
    for image in CADDY_IMAGE POSTGRES_IMAGE REDIS_IMAGE MINIO_IMAGE MINIO_CLIENT_IMAGE BACKUP_HELPER_IMAGE; do
      approved_image=$(value "$image" "$bundle/dependencies.env")
      selected_image=$approved_image
      if [[ -f "$root/compose.override.yml" && ( "$image" = MINIO_IMAGE || "$image" = MINIO_CLIENT_IMAGE ) ]]; then
        service=minio
        [[ "$image" != MINIO_CLIENT_IMAGE ]] || service=minio-init
        # config --images minio-init also includes minio. Extract only this
        # service from resolved JSON; protected values stay inside the pipe.
        selected_image=$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"][sys.argv[1]]["image"])' "$service")
        [[ "$selected_image" = "$approved_image" || "$selected_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'MinIO override requires its approved reference or a full local image ID'
      fi
      if [[ "$selected_image" =~ ^sha256:[a-f0-9]{64}$ ]]; then
        actual_image=$(docker image inspect --format '{{.Id}}' "$selected_image" 2>/dev/null) || fail 'approved dependency image must be preloaded explicitly'
        [[ "$actual_image" = "$selected_image" ]] || fail 'local dependency image identity differs'
      else
        docker image inspect "$selected_image" >/dev/null 2>&1 || fail 'approved dependency digest must be preloaded explicitly'
      fi
    done
    compose pull app worker frontend
    compose up -d --pull never postgres redis minio minio-init
    runtime_check infra "$root" "$release"
    if [[ "$operation" != rollback ]]; then
      compose run --rm --no-deps app npm run migration:run:prod
    fi
    if [[ "$operation" = bootstrap ]]; then compose run --rm --no-deps app npm run seed:prod; fi
    compose up -d --pull never --remove-orphans
    compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
    runtime_check ready "$root" "$release"
    [[ ! -f current-release ]] || cp current-release previous-release
    printf '%s\n%s\n' "$id" "$(value COMPOSE_PROJECT_NAME .env)" > installation-identity
    printf '%s\n' "$release" > current-release
    echo "Installation $id running bundle $release"
    ;;
  status)
    compose ps
    compose exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health/ready").then(r=>{process.stdout.write(`readiness=${r.status}\n`);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))'
    ;;
  *) fail 'usage: installation.sh validate|bootstrap|update|rollback|status ABSOLUTE_ROOT RELEASE' ;;
esac
