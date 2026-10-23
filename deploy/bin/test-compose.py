#!/usr/bin/env python3
"""Use local Docker only: exact digest images, no pulls or external network."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from operator_config import read_env
from runtime import configuration_hashes, execute, inspect_container


@unittest.skipUnless(shutil.which("docker"), "Docker CLI required")
class ComposeTest(unittest.TestCase):
    def test_resolved_env_file_hash_matches_container_and_detects_drift(self) -> None:
        image = subprocess.run(
            ["docker", "image", "inspect", "alpine:3.21", "--format", "{{.Id}}"],
            capture_output=True,
            text=True,
        )
        if image.returncode:
            self.skipTest("Preloaded local alpine required; no pull performed")
        with tempfile.TemporaryDirectory(
            prefix=".compose-hash-test-", dir=HERE.parent
        ) as directory:
            root = Path(directory).resolve()
            operator = root / "operator.env"
            literal = "literal spaces * [glob] $dollar ${UNSET_SYNTHETIC} #hash"
            operator.write_text("SYNTHETIC_HASH_TEST='" + literal + "'\n")
            configuration = root / "compose.json"
            configuration.write_text(
                json.dumps(
                    {
                        "services": {
                            "probe": {
                                "image": image.stdout.strip(),
                                "env_file": [str(operator)],
                                "command": ["sleep", "60"],
                            }
                        }
                    }
                )
            )
            command = [
                "docker",
                "compose",
                "--project-name",
                "autoflow-hash-" + str(os.getpid()),
                "--env-file",
                str(operator),
                "-f",
                str(configuration),
            ]
            try:
                execute(command + ["up", "-d", "--pull", "never"])
                current = inspect_container(execute(command + ["ps", "-q", "probe"]))
                actual_environment = dict(
                    value.split("=", 1) for value in current["Config"]["Env"]
                )
                self.assertEqual(actual_environment["SYNTHETIC_HASH_TEST"], literal)
                actual = current["Config"]["Labels"]["com.docker.compose.config-hash"]
                resolved = json.loads(execute(command + ["config", "--format", "json"]))
                self.assertEqual(
                    configuration_hashes(command, dict(os.environ), resolved)["probe"],
                    actual,
                )
                operator.write_text("SYNTHETIC_HASH_TEST=changed\n")
                changed = json.loads(execute(command + ["config", "--format", "json"]))
                self.assertNotEqual(
                    configuration_hashes(command, dict(os.environ), changed)["probe"],
                    actual,
                )
            finally:
                execute(command + ["down", "--remove-orphans"])

    def test_trailing_backslash_is_rejected_before_compose_parser(self) -> None:
        with tempfile.TemporaryDirectory(
            prefix=".compose-parser-test-", dir=HERE.parent
        ) as directory:
            root = Path(directory)
            env = root / ".env"
            env.write_text("KEY='trailing" + chr(92) + "'\n")
            # Admission rejects the unsupported grammar before a caller may
            # invoke Compose; independently confirm the real parser disagrees.
            with self.assertRaises(ValueError):
                read_env(env)
            config = root / "compose.json"
            config.write_text(
                json.dumps({"services": {"probe": {"image": "example/probe:unused"}}})
            )
            result = subprocess.run(
                [
                    "docker",
                    "compose",
                    "--env-file",
                    str(env),
                    "-f",
                    str(config),
                    "config",
                    "--quiet",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertNotEqual(result.returncode, 0)

    def test_pinned_services_and_literal_init_credential_argv(self) -> None:
        inspect = subprocess.run(
            [
                "docker",
                "image",
                "inspect",
                "alpine:3.21",
                "--format",
                "{{index .RepoDigests 0}}",
            ],
            capture_output=True,
            text=True,
        )
        if inspect.returncode:
            self.skipTest(
                "Preloaded local alpine:3.21 digest required; no pull performed"
            )
        image = inspect.stdout.strip()
        with tempfile.TemporaryDirectory(
            prefix=".compose-argv-test-", dir=HERE.parent
        ) as directory:
            root = Path(directory).resolve()
            (root / "output").mkdir()
            password = "literal spaces * [glob] $dollar #hash"
            values = {
                line.split("=", 1)[0]: line.split("=", 1)[1]
                for line in (HERE.parent / ".env.production.example")
                .read_text()
                .splitlines()
                if line and not line.startswith("#")
            }
            values.update(
                {
                    "INSTALLATION_ID": "argv-test",
                    "COMPOSE_PROJECT_NAME": "autoflow-argv-test",
                    "S3_ACCESS_KEY": "literal user*",
                    "S3_SECRET_KEY": "'" + password + "'",
                    "SITE_ADDRESS": "http://site.example",
                    "MEDIA_ADDRESS": "http://media.example",
                }
            )
            (root / ".env").write_text(
                "".join(key + "=" + value + "\n" for key, value in values.items())
            )
            keys = (
                "CADDY_IMAGE",
                "POSTGRES_IMAGE",
                "REDIS_IMAGE",
                "MINIO_IMAGE",
                "MINIO_CLIENT_IMAGE",
                "BACKUP_HELPER_IMAGE",
            )
            (root / "dependencies.env").write_text(
                "".join(key + "=" + image + "\n" for key in keys)
            )
            (root / "release.env").write_text(
                "APP_VERSION=fixture\nFRONTEND_VERSION=fixture\nBACKEND_IMAGE="
                + image
                + "\nFRONTEND_IMAGE="
                + image
                + "\n"
            )
            stub = root / "mc"
            stub.write_text("#!/bin/sh\nprintf '%s\\0' \"$@\" >> /output/argv.bin\n")
            stub.chmod(0o755)
            override = {
                "services": {
                    "minio-init": {
                        "network_mode": "none",
                        "environment": {"PATH": "/fixture:/bin:/usr/bin"},
                        "volumes": [
                            str(stub) + ":/fixture/mc:ro",
                            str(root / "output") + ":/output",
                        ],
                    }
                }
            }
            (root / "override.json").write_text(json.dumps(override))
            command = [
                "docker",
                "compose",
                "--project-name",
                "autoflow-argv-test",
                "--env-file",
                str(root / ".env"),
                "--env-file",
                str(root / "dependencies.env"),
                "--env-file",
                str(root / "release.env"),
                "-f",
                str(HERE.parent / "docker-compose.prod.yml"),
                "-f",
                str(root / "override.json"),
            ]
            environment = {**os.environ, "INSTALLATION_ROOT": str(root)}
            config = subprocess.run(
                command + ["config", "--format", "json"],
                env=environment,
                capture_output=True,
                text=True,
                check=True,
            )
            parsed = json.loads(config.stdout)
            self.assertTrue(
                all(
                    "@sha256:" in service["image"]
                    for service in parsed["services"].values()
                )
            )
            # Compose's rendered config escapes dollar signs again; verify the
            # effective credential at the real container argv boundary below.
            self.assertIsInstance(
                parsed["services"]["minio-init"]["environment"]["MINIO_ROOT_PASSWORD"],
                str,
            )
            ran = subprocess.run(
                command + ["run", "--rm", "--no-deps", "minio-init"],
                env=environment,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            self.assertEqual(
                ran.returncode, 0, ran.stderr.replace(password, "[redacted]")
            )
            actual = (root / "output/argv.bin").read_bytes().decode().split("\0")[:-1]
            self.assertEqual(
                actual,
                [
                    "alias",
                    "set",
                    "local",
                    "http://minio:9000",
                    "literal user*",
                    password,
                    "mb",
                    "--ignore-existing",
                    "local/autoflow",
                    "anonymous",
                    "set",
                    "download",
                    "local/autoflow",
                ],
            )


if __name__ == "__main__":
    unittest.main()
