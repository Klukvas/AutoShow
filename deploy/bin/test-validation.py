#!/usr/bin/env python3
"""Run without Docker or credentials; all fixtures live in a temporary task directory."""
import hashlib
import importlib.util
import shutil
import tempfile
import unittest
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from operator_config import DEPENDENCY_IMAGES, read_env

spec = importlib.util.spec_from_file_location(
    "installation_validation", HERE / "validate-installation.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load installation validator")
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


class ValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(
            prefix=".installation-validation-", dir=HERE.parent
        )
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / "releases" / "release-1"
        self.bundle.mkdir(parents=True)
        for directory in ("bin", "postgres-init"):
            (self.bundle / directory).mkdir()
        for name in (
            "installation.sh",
            "context.sh",
            "validate-installation.py",
            "snapshot.sh",
            "backup.sh",
            "restore-isolated.sh",
            "monitor.sh",
            "operator_config.py",
            "runtime.py",
            "validate-backup.py",
        ):
            shutil.copy(HERE / name, self.bundle / "bin" / name)
        for name in ("docker-compose.yml", "Caddyfile", "postgres-init/01-roles.sh"):
            (self.bundle / name).write_text("fixture")
        (self.bundle / "installation-id").write_text("dealer-a\n")
        (self.bundle / "source-sha").write_text("source-1\n")
        (self.bundle / "media-hosts").write_text("media.dealer-a.example\n")
        (self.bundle / "release.env").write_text(
            "APP_VERSION=source-1\nFRONTEND_VERSION=source-1-a\nBACKEND_IMAGE=example/backend@sha256:"
            + "a" * 64
            + "\nFRONTEND_IMAGE=example/frontend@sha256:"
            + "b" * 64
            + "\n"
        )
        (self.root / ".env").write_text(
            "INSTALLATION_ID=dealer-a\nCOMPOSE_PROJECT_NAME=autoflow-dealer-a\nS3_ENDPOINT=https://media.dealer-a.example\nS3_PUBLIC_URL=https://media.dealer-a.example/autoflow\nAPI_PREFIX=api\n"
        )
        pins = "".join(
            f'{key}=example/dependency@sha256:{"c"*64}\n' for key in DEPENDENCY_IMAGES
        )
        (self.bundle / "dependencies.env").write_text(pins)
        with (self.root / ".env").open("a") as stream:
            stream.write(pins)
        self.checksum()

    def checksum(self) -> None:
        files = sorted(
            p for p in self.bundle.rglob("*") if p.is_file() and p.name != "SHA256SUMS"
        )
        (self.bundle / "SHA256SUMS").write_text(
            "".join(
                hashlib.sha256(p.read_bytes()).hexdigest()
                + "  "
                + str(p.relative_to(self.bundle))
                + "\n"
                for p in files
            )
        )

    def test_accepts_valid_installation(self) -> None:
        validation.validate(self.root, "release-1")

    def test_accepts_other_origin_only_for_its_own_variant(self) -> None:
        (self.bundle / "media-hosts").write_text("http://127.0.0.1:8081\n")
        (self.root / ".env").write_text(
            (self.root / ".env")
            .read_text()
            .replace("https://media.dealer-a.example", "http://127.0.0.1:8081")
        )
        self.checksum()
        validation.validate(self.root, "release-1")

    def test_rejects_empty_manifest(self) -> None:
        (self.bundle / "SHA256SUMS").write_text("")
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_operator_keys_in_release(self) -> None:
        with (self.bundle / "release.env").open("a") as stream:
            stream.write("INSTALLATION_ID=other\n")
        self.checksum()
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_mutable_image(self) -> None:
        path = self.bundle / "release.env"
        path.write_text(
            path.read_text().replace(
                "example/backend@sha256:" + "a" * 64, "example/backend:latest"
            )
        )
        self.checksum()
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_wrong_frontend_origin(self) -> None:
        (self.bundle / "media-hosts").write_text("media.other.example\n")
        self.checksum()
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_changed_compose_identity(self) -> None:
        (self.root / "installation-identity").write_text("dealer-a\nautoflow\n")
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_missing_lifecycle_script(self) -> None:
        (self.bundle / "bin/snapshot.sh").unlink()
        self.checksum()
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_implicit_dependency_change(self) -> None:
        path = self.bundle / "dependencies.env"
        path.write_text(path.read_text().replace("c" * 64, "d" * 64))
        self.checksum()
        with self.assertRaises(ValueError):
            validation.validate(self.root, "release-1")

    def test_rejects_ambiguous_dotenv_keys_and_values(self) -> None:
        path = self.root / "grammar.env"
        for text in (
            "export INSTALLATION_ID=other\n",
            " INSTALLATION_ID=other\n",
            "INSTALLATION_ID =other\n",
            "INSTALLATION_ID=one\nINSTALLATION_ID=two\n",
            "KEY=value # comment\n",
            'KEY="interpolated"\n',
            "KEY=${OTHER}\n",
        ):
            with self.subTest(text=text):
                path.write_text(text)
                with self.assertRaises(ValueError):
                    read_env(path)

    def test_rejects_backslashes_in_quoted_literals(self) -> None:
        path = self.root / "grammar.env"
        for value in ("trailing" + chr(92), "embedded" + chr(92) + "slash"):
            path.write_text("KEY='" + value + "'\n")
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    read_env(path)

    def test_accepts_literal_single_quoted_spaces_and_globs(self) -> None:
        path = self.root / "grammar.env"
        path.write_text("KEY='space * [glob] $literal #hash'\n")
        self.assertEqual(read_env(path), {"KEY": "space * [glob] $literal #hash"})


if __name__ == "__main__":
    unittest.main()
