#!/usr/bin/env python3
"""Only regular files/directories may reach an isolated restore."""
import hashlib
import importlib.util
import io
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location(
    "backup_validation", HERE / "validate-backup.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load validator")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(
            prefix=".archive-test-", dir=HERE.parent
        )
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in backup.REQUIRED:
            (self.root / name).write_bytes(b"fixture")
        for name in ("minio.tar", "redis.tar"):
            with tarfile.open(self.root / name, "w") as archive:
                entry = tarfile.TarInfo("object")
                entry.size = 4
                archive.addfile(entry, io.BytesIO(b"data"))
        self.checksum()

    def checksum(self) -> None:
        (self.root / "SHA256SUMS").write_text(
            "".join(
                hashlib.sha256((self.root / name).read_bytes()).hexdigest()
                + "  "
                + name
                + "\n"
                for name in sorted(backup.REQUIRED)
            )
        )

    def test_accepts_regular_files_and_directories(self) -> None:
        backup.validate_backup(self.root)

    def test_multichunk_checksum_uses_only_bounded_reads(self) -> None:
        payload = bytes(range(256)) * 12288 + b"ending"
        expected = hashlib.sha256(payload).hexdigest()
        sizes: list[int] = []

        class BoundedReader(io.BytesIO):
            def read(self, size: int | None = -1) -> bytes:
                if size is None or not 0 < size <= 1024 * 1024:
                    raise AssertionError("Checksum requested an unbounded read")
                sizes.append(size)
                return super().read(size)

        with patch.object(
            Path, "open", return_value=BoundedReader(payload)
        ), patch.object(
            Path, "read_bytes", side_effect=AssertionError("Whole-file read forbidden")
        ):
            self.assertEqual(backup.file_sha256(Path("fixture")), expected)
        self.assertEqual(sizes, [1024 * 1024] * 5)

    def test_restore_validation_never_reads_whole_archives(self) -> None:
        with patch.object(
            Path, "read_bytes", side_effect=AssertionError("Whole-file read forbidden")
        ):
            backup.validate_backup(self.root)

    def test_rejects_every_special_type_before_restore(self) -> None:
        for kind in (
            tarfile.FIFOTYPE,
            tarfile.CHRTYPE,
            tarfile.BLKTYPE,
            tarfile.SYMTYPE,
            tarfile.LNKTYPE,
        ):
            with self.subTest(kind=kind):
                with tarfile.open(self.root / "minio.tar", "w") as archive:
                    entry = tarfile.TarInfo("special")
                    entry.type = kind
                    entry.linkname = "target"
                    archive.addfile(entry)
                self.checksum()
                with self.assertRaises(ValueError):
                    backup.validate_backup(self.root)


if __name__ == "__main__":
    unittest.main()
