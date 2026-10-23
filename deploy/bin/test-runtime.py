#!/usr/bin/env python3
"""Regression tests for image/config identity, cold readiness and exact resume."""
import importlib.util
import http.server
import subprocess
import threading
import json
import sys
import unittest
from typing import Any
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import runtime


class RuntimeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.states: dict[str, dict[str, Any]] = {
            name: {
                "Id": name + "-id",
                "Image": name + "-image",
                "RestartCount": 0,
                "Config": {
                    "Labels": {"com.docker.compose.config-hash": name + "-hash"}
                },
                "State": {
                    "Status": "exited" if name == "minio-init" else "running",
                    "Running": name != "minio-init",
                    "ExitCode": 0,
                    "Health": {"Status": "healthy"},
                },
            }
            for name in (*runtime.RUNNING, "minio-init")
        }

    def execute(
        self, arguments: list[str], environment: dict[str, str] | None = None
    ) -> str:
        if "--format" in arguments:
            return json.dumps(
                {"services": {name: {"image": name + "-pin"} for name in self.states}}
            )
        if "--hash" in arguments:
            return "\n".join(name + " " + name + "-hash" for name in self.states)
        if "ps" in arguments:
            return arguments[-1] + "-id"
        if arguments[:3] == ["docker", "image", "inspect"]:
            return json.dumps([{"Id": arguments[-1].removesuffix("-pin") + "-image"}])
        raise AssertionError("Unexpected command")

    def test_runtime_requires_actual_image_id_and_config_hash(self) -> None:
        with patch.object(
            runtime, "compose_command", return_value=(["docker", "compose"], {})
        ), patch.object(runtime, "execute", side_effect=self.execute), patch.object(
            runtime,
            "inspect_container",
            side_effect=lambda identifier: self.states[identifier.removesuffix("-id")],
        ):
            result = runtime.runtime(Path("/fixture"), "release")
            self.assertEqual(result["app"]["image"], "app-image")
            self.states["app"]["Image"] = "another-image"
            with self.assertRaises(ValueError):
                runtime.runtime(Path("/fixture"), "release")
            self.states["app"]["Image"] = "app-image"
            self.states["app"]["Config"]["Labels"][
                "com.docker.compose.config-hash"
            ] = "stale-config"
            with self.assertRaises(ValueError):
                runtime.runtime(Path("/fixture"), "release")

    def test_resume_starts_exact_original_ids_without_recreate(self) -> None:
        captured = {
            name: {
                "id": data["Id"],
                "image": data["Image"],
                "hash": data["Config"]["Labels"]["com.docker.compose.config-hash"],
            }
            for name, data in self.states.items()
        }
        calls: list[list[str]] = []

        def record(arguments: list[str]) -> str:
            calls.append(arguments)
            return ""

        with patch.object(
            runtime,
            "inspect_container",
            side_effect=lambda identifier: self.states[identifier.removesuffix("-id")],
        ), patch.object(runtime, "healthy", return_value=True), patch.object(
            runtime, "execute", side_effect=record
        ):
            runtime.resume(captured)
        self.assertEqual(
            calls,
            [
                ["docker", "start", "redis-id", "minio-id"],
                ["docker", "start", "app-id", "worker-id", "frontend-id"],
            ],
        )

    def test_init_failure_blocks_dependency_gate(self) -> None:
        self.states["minio-init"]["State"]["ExitCode"] = 1
        with patch.object(
            runtime, "compose_command", return_value=(["docker", "compose"], {})
        ), patch.object(runtime, "execute", side_effect=self.execute), patch.object(
            runtime,
            "inspect_container",
            side_effect=lambda identifier: self.states[identifier.removesuffix("-id")],
        ):
            with self.assertRaises(ValueError):
                runtime.wait_infra(Path("/fixture"), "release", seconds=1)

    def test_ingress_failure_or_restarting_service_never_passes(self) -> None:
        with patch.object(
            runtime, "compose_command", return_value=(["docker", "compose"], {})
        ), patch.object(
            runtime,
            "read_env",
            return_value={
                "SITE_ADDRESS": "http://fixture",
                "FRONTEND_VERSION": "version",
            },
        ), patch.object(
            runtime, "runtime", return_value={"app": {"restarts": 1}}
        ), patch.object(
            runtime, "execute", side_effect=ValueError("frontend unavailable")
        ), patch.object(
            runtime.time, "sleep"
        ):
            with self.assertRaises(ValueError):
                runtime.wait_ready(Path("/fixture"), "release", seconds=0)
        self.states["frontend"]["State"]["Restarting"] = True
        with patch.object(
            runtime, "compose_command", return_value=(["docker", "compose"], {})
        ), patch.object(runtime, "execute", side_effect=self.execute), patch.object(
            runtime,
            "inspect_container",
            side_effect=lambda identifier: self.states[identifier.removesuffix("-id")],
        ):
            with self.assertRaises(ValueError):
                runtime.runtime(Path("/fixture"), "release")

    def test_real_http_ingress_gate_requires_frontend_and_api_version(self) -> None:
        responses: dict[str, tuple[int, str]] = {
            "/": (200, "storefront"),
            "/api/health/ready": (200, "{}"),
            "/health/frontend": (200, '{"status":"ok","version":"expected"}'),
        }

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                status, body = responses[self.path]
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, format: str, *arguments: object) -> None:
                return

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            script = runtime.INGRESS_CHECK.replace(
                "hostname:'caddy'", "hostname:'127.0.0.1'"
            )
            command = [
                "node",
                "-e",
                script,
                f"http://fixture:{server.server_port}",
                "expected",
            ]
            self.assertEqual(
                subprocess.run(command, capture_output=True, timeout=5).returncode, 0
            )
            for path, response in [
                ("/health/frontend", (200, '{"status":"ok","version":"wrong"}')),
                ("/health/frontend", (503, "{}")),
                ("/api/health/ready", (503, "{}")),
                ("/", (502, "unavailable")),
            ]:
                previous = responses[path]
                responses[path] = response
                with self.subTest(path=path, response=response):
                    self.assertNotEqual(
                        subprocess.run(
                            command, capture_output=True, timeout=5
                        ).returncode,
                        0,
                    )
                responses[path] = previous
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
