#!/usr/bin/env python3
"""Reject incomplete, corrupted or special-file archives before recovery writes."""
import hashlib
import sys
import tarfile
from pathlib import Path

REQUIRED = {
    "database.dump",
    "minio.tar",
    "redis.tar",
    "release.env",
    "migration-count",
    "installation-id",
    "release-bundle",
    "app-role",
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def validate_backup(root: Path) -> None:
    rows = (root / "SHA256SUMS").read_text().splitlines()
    listed = [row.split("  ", 1)[1] for row in rows]
    if set(listed) != REQUIRED or len(listed) != len(REQUIRED):
        raise ValueError("Incomplete backup manifest")
    for row in rows:
        checksum, relative = row.split("  ", 1)
        path = root / relative
        if path.is_symlink() or file_sha256(path) != checksum:
            raise ValueError("Backup checksum mismatch")
    for name in ("minio.tar", "redis.tar"):
        with tarfile.open(root / name) as archive:
            for entry in archive:
                path = Path(entry.name)
                if (
                    path.is_absolute()
                    or ".." in path.parts
                    or not (entry.isfile() or entry.isdir())
                ):
                    raise ValueError(
                        "Archive permits only regular files and directories"
                    )


if __name__ == "__main__":
    try:
        validate_backup(Path(sys.argv[1]))
    except (ValueError, OSError, IndexError, tarfile.TarError):
        sys.exit("Invalid backup manifest, checksum or archive member")
