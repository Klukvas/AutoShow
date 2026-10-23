#!/usr/bin/env python3
"""Bounded, sanitized operational checks. Never emit container environment values."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True
from operator_config import read_env

RUNNING = ("app", "worker", "frontend", "caddy", "postgres", "redis", "minio")
INFRA = ("postgres", "redis", "minio")


def execute(
    arguments: list[str],
    environment: dict[str, str] | None = None,
    input_text: str | None = None,
) -> str:
    try:
        return subprocess.run(
            arguments,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
            timeout=15,
            input=input_text,
        ).stdout.strip()
    except (subprocess.SubprocessError, OSError) as error:
        raise ValueError("Docker/Compose check failed") from error


def inspect_container(identifier: str) -> dict[str, Any]:
    return json.loads(execute(["docker", "inspect", identifier]))[0]


def compose_command(root: Path, release: str) -> tuple[list[str], dict[str, str]]:
    # The strict validator has already accepted these files; no shell evaluation.
    values = read_env(root / ".env")
    bundle = root / "releases" / release
    environment = {
        key: value
        for key, value in os.environ.items()
        if key
        in {
            "PATH",
            "HOME",
            "DOCKER_CONFIG",
            "DOCKER_HOST",
            "DOCKER_CONTEXT",
            "DOCKER_TLS_VERIFY",
            "DOCKER_CERT_PATH",
            "SSH_AUTH_SOCK",
        }
    }
    environment["INSTALLATION_ROOT"] = str(root)
    command = [
        "docker",
        "compose",
        "--project-name",
        values["COMPOSE_PROJECT_NAME"],
        "--env-file",
        str(root / ".env"),
        "--env-file",
        str(bundle / "dependencies.env"),
        "--env-file",
        str(bundle / "release.env"),
        "--project-directory",
        str(bundle),
        "-f",
        str(bundle / "docker-compose.yml"),
    ]
    return command, environment


def configuration_hashes(
    command: list[str],
    environment: dict[str, str],
    configuration: dict[str, Any],
) -> dict[str, str]:
    # Compose versions affected by docker/compose#14001 hash unresolved env_file
    # values differently from `up`. Hash the resolved model through stdin instead;
    # operator secrets stay in memory and never enter argv or a temporary file.
    return dict(
        line.split()
        for line in execute(
            command[:-1] + ["-", "config", "--hash", "*"],
            environment,
            json.dumps(configuration),
        ).splitlines()
    )


def runtime(root: Path, release: str) -> dict[str, dict[str, Any]]:
    command, environment = compose_command(root, release)
    configuration = json.loads(
        execute(command + ["config", "--format", "json"], environment)
    )
    hashes = configuration_hashes(command, environment, configuration)
    result = {}
    for service in (*RUNNING, "minio-init"):
        identifier = execute(command + ["ps", "-aq", service], environment)
        if not identifier or "\n" in identifier:
            raise ValueError("Expected exactly one container for " + service)
        current = inspect_container(identifier)
        expected_image = configuration["services"][service]["image"]
        expected_id = json.loads(
            execute(["docker", "image", "inspect", expected_image])
        )[0]["Id"]
        actual_hash = current["Config"]["Labels"].get("com.docker.compose.config-hash")
        if current["Image"] != expected_id or actual_hash != hashes[service]:
            raise ValueError(
                "Running image/config differs from selected bundle: " + service
            )
        state = current["State"]
        if service == "minio-init":
            if state["Status"] != "exited" or state["ExitCode"] != 0:
                raise ValueError(
                    "Storage initialization has not completed successfully"
                )
        elif not state["Running"] or state.get("Restarting") or state.get("Dead"):
            raise ValueError("Service is not stably running: " + service)
        result[service] = {
            "id": current["Id"],
            "image": current["Image"],
            "hash": actual_hash,
            "restarts": current["RestartCount"],
        }
    return result


def healthy(identifier: str) -> bool:
    state = inspect_container(identifier)["State"]
    if state["Status"] in ("dead", "exited"):
        raise ValueError("Required dependency exited")
    return bool(state["Running"] and state.get("Health", {}).get("Status") == "healthy")


def wait_infra(root: Path, release: str, seconds: int = 90) -> None:
    command, environment = compose_command(root, release)
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        identifiers = [
            execute(command + ["ps", "-aq", service], environment) for service in INFRA
        ]
        init = execute(command + ["ps", "-aq", "minio-init"], environment)
        initialized = False
        if init:
            state = inspect_container(init)["State"]
            if state["Status"] == "exited":
                if state["ExitCode"] != 0:
                    raise ValueError("Storage initialization failed")
                initialized = True
        if (
            all(identifiers)
            and all(healthy(identifier) for identifier in identifiers)
            and initialized
        ):
            return
        time.sleep(1)
    raise ValueError("Dependency health/init deadline exceeded")


INGRESS_CHECK = r"""
const http = require('node:http'), https = require('node:https');
const site = new URL(process.argv[1].includes('://') ? process.argv[1] : 'https://'+process.argv[1]);
function check(path, expectedVersion) {
  return new Promise((resolve,reject) => {
    const transport = site.protocol==='https:' ? https : http;
    const req = transport.request({hostname:'caddy',port:site.port||(site.protocol==='https:'?443:80),servername:site.hostname,method:'GET',path,headers:{host:site.host},timeout:3000}, res => {
      if(res.statusCode!==200) {res.resume();reject(Error('status'));return;}
      if(!expectedVersion) {res.resume();resolve();return;}
      let body='';res.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy(Error('size'));});
      res.on('end',()=>{try{const value=JSON.parse(body);value.status==='ok'&&value.version===expectedVersion?resolve():reject(Error('version'));}catch{reject(Error('json'));}});
    });
    req.on('timeout',()=>req.destroy(Error('timeout')));req.on('error',reject);req.end();
  });
}
Promise.all([check('/'),check('/api/health/ready'),check('/health/frontend',process.argv[2])]).then(()=>process.exit(0)).catch(()=>process.exit(1));
"""


def wait_ready(root: Path, release: str, seconds: int = 120) -> None:
    command, environment = compose_command(root, release)
    operator = read_env(root / ".env")
    artifact = read_env(root / "releases" / release / "release.env")
    deadline = time.monotonic() + seconds
    previous = None
    while time.monotonic() < deadline:
        try:
            current = runtime(root, release)
            execute(
                command
                + [
                    "exec",
                    "-T",
                    "frontend",
                    "node",
                    "-e",
                    INGRESS_CHECK,
                    operator["SITE_ADDRESS"],
                    artifact["FRONTEND_VERSION"],
                ],
                environment,
            )
            if previous == current:
                return
            previous = current
        except ValueError:
            previous = None
        time.sleep(2)
    raise ValueError(
        "Ingress/frontend-version/service stability deadline exceeded; pointer unchanged"
    )


def resume(containers: dict[str, dict[str, Any]], seconds: int = 90) -> None:
    # Start exact original IDs only. Never compose up, pull, migrate, or recreate.
    for service in (*INFRA, "app", "worker", "frontend"):
        expected = containers[service]
        current = inspect_container(expected["id"])
        if (
            current["Image"] != expected["image"]
            or current["Config"]["Labels"].get("com.docker.compose.config-hash")
            != expected["hash"]
        ):
            raise ValueError("Original container identity changed; refusing resume")
    execute(["docker", "start", containers["redis"]["id"], containers["minio"]["id"]])
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if all(healthy(containers[service]["id"]) for service in INFRA):
            execute(
                [
                    "docker",
                    "start",
                    *(
                        containers[service]["id"]
                        for service in ("app", "worker", "frontend")
                    ),
                ]
            )
            return
        time.sleep(1)
    raise ValueError("Original dependency containers did not recover")


if __name__ == "__main__":
    try:
        operation = sys.argv[1]
        if operation == "resume":
            resume(json.load(sys.stdin))
        elif operation == "running":
            print(json.dumps(runtime(Path(sys.argv[2]), sys.argv[3])))
        elif operation == "infra":
            wait_infra(Path(sys.argv[2]), sys.argv[3])
        elif operation == "ready":
            wait_ready(Path(sys.argv[2]), sys.argv[3])
        else:
            raise ValueError("Unknown runtime check")
    except (ValueError, KeyError, OSError, IndexError):
        sys.exit(
            "Runtime verification failed; inspect local service state, images, config and ingress"
        )
