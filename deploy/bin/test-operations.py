#!/usr/bin/env python3
"""Exercise lifecycle ordering, failure pointers, snapshot admission and locks."""
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent


class OperationsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(
            prefix=".operations-test-", dir=HERE.parent
        )
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.bundle = self.root / "releases" / "new"
        self.bundle.mkdir(parents=True)
        shutil.copytree(
            HERE, self.bundle / "bin", ignore=shutil.ignore_patterns("__pycache__")
        )
        (self.bundle / "postgres-init").mkdir()
        for name in ("docker-compose.yml", "Caddyfile", "postgres-init/01-roles.sh"):
            (self.bundle / name).write_text("fixture")
        (self.bundle / "installation-id").write_text("test\n")
        (self.bundle / "source-sha").write_text("source\n")
        (self.bundle / "media-hosts").write_text("media.example\n")
        pins = "".join(
            f'{name}=example/dependency@sha256:{"a"*64}\n'
            for name in (
                "CADDY_IMAGE",
                "POSTGRES_IMAGE",
                "REDIS_IMAGE",
                "MINIO_IMAGE",
                "MINIO_CLIENT_IMAGE",
                "BACKUP_HELPER_IMAGE",
            )
        )
        (self.root / ".env").write_text(
            "INSTALLATION_ID=test\nCOMPOSE_PROJECT_NAME=autoflow-test\nS3_ENDPOINT=https://media.example\nS3_PUBLIC_URL=https://media.example/bucket\nSITE_ADDRESS=https://site.example\n"
            + pins
        )
        (self.bundle / "dependencies.env").write_text(pins)
        (self.bundle / "release.env").write_text(
            f'APP_VERSION=source\nFRONTEND_VERSION=source\nBACKEND_IMAGE=example/backend@sha256:{"b"*64}\nFRONTEND_IMAGE=example/frontend@sha256:{"c"*64}\n'
        )
        (self.root / "current-release").write_text("old\n")
        self.bin = self.root / "commands"
        self.bin.mkdir()
        self.log = self.root / "calls.jsonl"
        # Production uses util-linux flock. The local macOS harness implements
        # the same inherited-descriptor flock semantics, without installing it.
        self.script(
            "flock",
            """import fcntl,sys
try: fcntl.flock(int(sys.argv[-1]),fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError: sys.exit(1)
""",
        )
        self.script(
            "docker",
            f"""import json,sys
with open({str(self.log)!r},'a') as stream: stream.write(json.dumps(sys.argv[1:])+'\\n')
""",
        )
        self.environment = {
            **os.environ,
            "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        self.runtime_stub("ok")

    def script(self, name: str, body: str) -> None:
        path = self.bin / name
        path.write_text("#!" + sys.executable + "\n" + body)
        path.chmod(0o700)

    def runtime_stub(self, failure: str) -> None:
        (self.bundle / "bin/runtime.py").write_text(
            f"""import json,sys
with open({str(self.log)!r},'a') as stream: stream.write(json.dumps(['runtime',sys.argv[1]])+'\\n')
if sys.argv[1]=={failure!r}: sys.exit(1)
"""
        )
        self.checksum()

    def checksum(self) -> None:
        paths = sorted(
            p for p in self.bundle.rglob("*") if p.is_file() and p.name != "SHA256SUMS"
        )
        (self.bundle / "SHA256SUMS").write_text(
            "".join(
                hashlib.sha256(p.read_bytes()).hexdigest()
                + "  "
                + str(p.relative_to(self.bundle))
                + "\n"
                for p in paths
            )
        )

    def run_script(
        self, script: str, *arguments: str
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(self.bundle / "bin" / script), *arguments],
            env=self.environment,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def calls(self) -> list[list[str]]:
        return (
            [json.loads(line) for line in self.log.read_text().splitlines()]
            if self.log.exists()
            else []
        )

    def test_migration_waits_for_dependency_init_and_pointer_waits_for_ingress(
        self,
    ) -> None:
        result = self.run_script("installation.sh", "update", str(self.root), "new")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls()
        infra = calls.index(["runtime", "infra"])
        ready = calls.index(["runtime", "ready"])
        migrate = next(
            i for i, args in enumerate(calls) if "migration:run:prod" in args
        )
        self.assertLess(infra, migrate)
        self.assertLess(migrate, ready)
        self.assertEqual((self.root / "current-release").read_text(), "new\n")
        pull = next(args for args in calls if "pull" in args)
        self.assertEqual(pull[-3:], ["app", "worker", "frontend"])

    def test_init_failure_never_migrates_or_advances_pointer(self) -> None:
        self.runtime_stub("infra")
        self.assertNotEqual(
            self.run_script(
                "installation.sh", "update", str(self.root), "new"
            ).returncode,
            0,
        )
        self.assertFalse(any("migration:run:prod" in args for args in self.calls()))
        self.assertEqual((self.root / "current-release").read_text(), "old\n")

    def test_frontend_or_caddy_failure_never_advances_pointer(self) -> None:
        self.runtime_stub("ready")
        self.assertNotEqual(
            self.run_script(
                "installation.sh", "update", str(self.root), "new"
            ).returncode,
            0,
        )
        self.assertEqual((self.root / "current-release").read_text(), "old\n")

    def test_snapshot_mismatch_has_no_docker_mutations_or_dump(self) -> None:
        (self.root / "current-release").write_text("new\n")
        self.runtime_stub("running")
        self.assertNotEqual(
            self.run_script(
                "snapshot.sh", str(self.root), "new", "20261023T140000Z"
            ).returncode,
            0,
        )
        self.assertEqual(self.calls()[-1], ["runtime", "running"])
        self.assertTrue(
            all(
                args[:2] == ["image", "inspect"] or args == ["runtime", "running"]
                for args in self.calls()
            )
        )
        self.assertFalse((self.root / "backups").exists())

    def test_shared_lock_rejects_every_mutator_before_docker(self) -> None:
        with (self.root / ".operation.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            for name, args in [
                ("installation.sh", ("update", str(self.root), "new")),
                ("snapshot.sh", (str(self.root), "new", "20261023T140000Z")),
                (
                    "restore-isolated.sh",
                    (str(self.root), "new", str(self.root / "backup")),
                ),
            ]:
                with self.subTest(name=name):
                    result = self.run_script(name, *args)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(
                        "another lifecycle/snapshot/restore operation", result.stderr
                    )
            self.assertEqual(self.calls(), [])


if __name__ == "__main__":
    unittest.main()
