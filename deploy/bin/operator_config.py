"""One supported dotenv grammar shared by validation and operational checks."""

import re
from pathlib import Path

DEPENDENCY_IMAGES = (
    "CADDY_IMAGE",
    "POSTGRES_IMAGE",
    "REDIS_IMAGE",
    "MINIO_IMAGE",
    "MINIO_CLIENT_IMAGE",
    "BACKUP_HELPER_IMAGE",
)
IMAGE_PATTERN = r"[A-Za-z0-9][A-Za-z0-9./:_-]*@sha256:[a-f0-9]{64}"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, raw = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in values:
            raise ValueError("Invalid or duplicate dotenv key")
        if raw.startswith("'"):
            if (
                len(raw) < 2
                or not raw.endswith("'")
                or "'" in raw[1:-1]
                or "\\" in raw[1:-1]
            ):
                raise ValueError("Unsupported dotenv quoting")
            value = raw[1:-1]
        else:
            if raw != raw.strip() or any(character in raw for character in "#'\"$\\\t"):
                raise ValueError("Use a single-quoted literal dotenv value")
            value = raw
        values[key] = value
    return values
