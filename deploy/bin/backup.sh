#!/usr/bin/env bash
set -euo pipefail
# Requires age + rsync + SSH, with trusted host keys already installed.
source "$(dirname "$0")/context.sh" "${1:-}" "${2:-}"
recipient=${3:-}; destination=${4:-}
[[ -n "$recipient" && "$destination" =~ ^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+:/[a-zA-Z0-9/_.-]+$ ]] || fail 'age recipient and explicit user@offserver:/path required'
[[ "$(cat current-release)" = "$release" ]] || fail 'backup must use the running release bundle'
command -v age >/dev/null; command -v rsync >/dev/null
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
setdir="$root/backups/$stamp"
bash "$bundle/bin/snapshot.sh" "$root" "$release" "$stamp"
# Secrets/master encryption key are backed up separately to an operator vault.
# This set includes private customer data and is encrypted before offserver copy.
tar -C "$setdir" -cf - . | age -r "$recipient" -o "$root/backups/$stamp.tar.age"
rsync --chmod=F600 -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes' "$root/backups/$stamp.tar.age" "$destination/"
# Mark success ONLY after encryption and successful offserver transfer.
printf '%s\n' "$stamp" > "$root/status/last-offserver-backup"
echo "Backup completed for $id at $stamp"
