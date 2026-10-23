#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/context.sh" "${1:-}" "${2:-}"
max_age=${3:-30}
[[ "$max_age" =~ ^[0-9]+$ ]] || fail 'backup age must be hours'
compose exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
# Check the host data disk as well as the app filesystem readiness check.
python3 - "$root" "$max_age" <<'PY'
import datetime, shutil, sys
from pathlib import Path
root = Path(sys.argv[1])
if shutil.disk_usage(root).free < 2 * 1024 ** 3:
    sys.exit('Host data disk below 2 GiB free')
now = datetime.datetime.now(datetime.timezone.utc)
for name in ('last-local-backup', 'last-offserver-backup'):
    try:
        stamp = datetime.datetime.strptime((root/'status'/name).read_text().strip(), '%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)
    except (OSError, ValueError):
        sys.exit('Backup status missing or invalid: ' + name)
    if not 0 <= (now-stamp).total_seconds() <= int(sys.argv[2])*3600:
        sys.exit('Backup status stale: ' + name)
print('Readiness, worker release, host disk, local and offserver backup freshness passed')
PY
