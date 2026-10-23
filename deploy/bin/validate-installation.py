#!/usr/bin/env python3
"""Validate operator/artifact boundary without evaluating or displaying secrets."""
import hashlib
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.dont_write_bytecode = True
from operator_config import DEPENDENCY_IMAGES, IMAGE_PATTERN, read_env


def validate(root: Path, release: str) -> None:
    bundle = root / "releases" / release
    operator = read_env(root / ".env")
    artifact = read_env(bundle / "release.env")
    required = {"BACKEND_IMAGE", "FRONTEND_IMAGE", "APP_VERSION", "FRONTEND_VERSION"}
    if set(artifact) != required:
        raise ValueError("release.env must contain only pinned image and version keys")
    dependencies = read_env(bundle / "dependencies.env")
    if set(dependencies) != set(DEPENDENCY_IMAGES):
        raise ValueError("Explicit approved dependency manifest required")
    for name in DEPENDENCY_IMAGES:
        if (
            not re.fullmatch(IMAGE_PATTERN, dependencies[name])
            or operator.get(name) != dependencies[name]
        ):
            raise ValueError("Dependency pin differs from operator-approved image")
    for name in ("BACKEND_IMAGE", "FRONTEND_IMAGE"):
        if not re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9./:_-]*@sha256:[a-f0-9]{64}", artifact[name]
        ):
            raise ValueError(name + " requires an immutable digest")
    for name in ("APP_VERSION", "FRONTEND_VERSION"):
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", artifact[name]):
            raise ValueError("invalid " + name)
    installation = operator.get("INSTALLATION_ID", "")
    project = operator.get("COMPOSE_PROJECT_NAME", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}", installation):
        raise ValueError("invalid installation ID")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,62}", project):
        raise ValueError("explicit stable COMPOSE_PROJECT_NAME required")
    if (bundle / "installation-id").read_text().strip() != installation:
        raise ValueError("release belongs to another installation")
    if (bundle / "source-sha").read_text().strip() != artifact["APP_VERSION"]:
        raise ValueError("release source/version mismatch")
    identity = root / "installation-identity"
    if (
        identity.exists()
        and identity.read_text() != installation + "\n" + project + "\n"
    ):
        raise ValueError(
            "installation or compose identity changed; existing data must be adopted explicitly"
        )
    if operator.get("API_PREFIX", "api") != "api":
        raise ValueError("production Caddy bundle requires API_PREFIX=api")
    origin = lambda value: urlparse(value if "://" in value else "https://" + value)
    allowed = {
        (origin(v.strip()).scheme, origin(v.strip()).netloc)
        for v in (bundle / "media-hosts").read_text().strip().split(",")
        if v.strip()
    }
    endpoint = origin(operator.get("S3_ENDPOINT", ""))
    public = origin(operator.get("S3_PUBLIC_URL", ""))
    if (
        not endpoint.netloc
        or (endpoint.scheme, endpoint.netloc) not in allowed
        or (public.scheme, public.netloc) not in allowed
    ):
        raise ValueError(
            "S3 public/presign origins do not match this frontend artifact; rebuild for changed origins"
        )
    expected = {
        str(path.relative_to(bundle))
        for path in bundle.rglob("*")
        if path.is_file() and path.name != "SHA256SUMS"
    }
    essential = {
        "release.env",
        "dependencies.env",
        "bin/operator_config.py",
        "bin/runtime.py",
        "bin/validate-backup.py",
        "installation-id",
        "source-sha",
        "media-hosts",
        "docker-compose.yml",
        "Caddyfile",
        "postgres-init/01-roles.sh",
        "bin/installation.sh",
        "bin/context.sh",
        "bin/validate-installation.py",
        "bin/snapshot.sh",
        "bin/backup.sh",
        "bin/restore-isolated.sh",
        "bin/monitor.sh",
    }
    rows = (bundle / "SHA256SUMS").read_text().splitlines()
    listed = [row.split("  ", 1)[1].removeprefix("./") for row in rows]
    if (
        set(listed) != expected
        or len(listed) != len(expected)
        or not essential.issubset(expected)
    ):
        raise ValueError("incomplete release manifest")
    for row in rows:
        checksum, relative = row.split("  ", 1)
        path = (bundle / relative).resolve()
        if (
            not path.is_relative_to(bundle.resolve())
            or hashlib.sha256(path.read_bytes()).hexdigest() != checksum
        ):
            raise ValueError("release bundle checksum mismatch")


if __name__ == "__main__":
    try:
        if sys.argv[1] == "--value":
            print(read_env(Path(sys.argv[2]))[sys.argv[3]])
        else:
            validate(Path(sys.argv[1]), sys.argv[2])
    except (ValueError, OSError, IndexError, KeyError):
        sys.exit(
            "Invalid installation or release bundle; check identity, digest pins, media origins and checksums"
        )
