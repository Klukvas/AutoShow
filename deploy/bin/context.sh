#!/usr/bin/env bash
# Shared by lifecycle/backup tooling; all arguments name one local installation.
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
fail() { echo "ERROR: $*" >&2; exit 1; }
root=${1:-}; release=${2:-}
[[ "$root" = /* && "$root" != / ]] || fail 'absolute installation root required'
[[ "$release" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail 'release bundle name required'
cd "$root"
export INSTALLATION_ROOT="$PWD"
bundle="$PWD/releases/$release"
[[ -f .env && -f "$bundle/release.env" ]] || fail 'operator .env and complete release bundle required'
python3 "$bundle/bin/validate-installation.py" "$root" "$release"
value() { python3 "$bundle/bin/validate-installation.py" --value "$2" "$1"; }
id=$(value INSTALLATION_ID .env)
project=$(value COMPOSE_PROJECT_NAME .env)
export INSTALLATION_ID="$id"
# Operator/release files, not unrelated shell env, own compose interpolation.
# Retain only the caller's Docker transport/registry context.
compose() {
  env -i PATH="$PATH" HOME="$HOME" \
    DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" \
    DOCKER_HOST="${DOCKER_HOST:-}" DOCKER_CONTEXT="${DOCKER_CONTEXT:-}" \
    DOCKER_TLS_VERIFY="${DOCKER_TLS_VERIFY:-}" DOCKER_CERT_PATH="${DOCKER_CERT_PATH:-}" \
    SSH_AUTH_SOCK="${SSH_AUTH_SOCK:-}" INSTALLATION_ROOT="$root" \
    docker compose --project-name "$project" --env-file "$root/.env" \
    --env-file "$bundle/dependencies.env" --env-file "$bundle/release.env" --project-directory "$bundle" \
    -f "$bundle/docker-compose.yml" "$@"
}

lock_installation() {
  command -v flock >/dev/null || fail 'Linux flock is required for installation mutations'
  [[ ! -L "$root/.operation.lock" ]] || fail 'operation lock must not be a symlink'
  exec 9>"$root/.operation.lock"
  flock -n 9 || fail 'another lifecycle/snapshot/restore operation is active'
}
runtime_check() { python3 "$bundle/bin/runtime.py" "$@"; }
