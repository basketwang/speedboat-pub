"""In-memory store with optional file persistence.

Seeded from seed-data.json on first start. If MOCK_PERSIST_PATH is set,
writes mutations through to that path so created keys / deployments survive
container restarts. Otherwise everything resets when the process restarts.
"""
from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

SEED_PATH = Path(__file__).parent / "seed-data.json"


class Store:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._persist_path = os.getenv("MOCK_PERSIST_PATH") or None
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self._persist_path and Path(self._persist_path).exists():
            with open(self._persist_path) as f:
                return self._migrate(json.load(f))
        with open(SEED_PATH) as f:
            return self._migrate(json.load(f))

    def _migrate(self, state: dict[str, Any]) -> dict[str, Any]:
        state.setdefault("deployment_logs", {})
        for dep in state.get("deployments", []):
            if not dep.get("revisions"):
                revision = {
                    "id": f"{dep['id']}-rev-001",
                    "deployment_run_id": f"run_{dep['id']}_001",
                    "deployment_id": dep["id"],
                    "version": 1,
                    "model_source": dep["model_source"],
                    "gpu_type": dep["gpu_type"],
                    "replicas": dep["replicas"],
                    "autoscaling": deepcopy(dep["autoscaling"]),
                    "env": deepcopy(dep.get("env", {})),
                    "status": dep["status"],
                    "endpoint_url": dep.get("endpoint_url"),
                    "created_at": dep["created_at"],
                    "started_at": dep["created_at"],
                    "finished_at": dep["updated_at"] if dep["status"] == "running" else None,
                    "updated_at": dep["updated_at"],
                    "activated_at": dep["updated_at"] if dep["status"] == "running" else None,
                    "deactivated_at": None,
                }
                dep["active_revision_id"] = revision["id"]
                dep["revision"] = deepcopy(revision)
                dep["revisions"] = [revision]
            for revision in dep.get("revisions", []):
                revision.setdefault("deployment_run_id", f"run_{revision['id']}")
                revision.setdefault("started_at", revision.get("created_at"))
                revision.setdefault("finished_at", revision.get("activated_at"))
                revision.setdefault("deactivated_at", None)
            active_revision_id = dep.get("active_revision_id")
            for revision in dep.get("revisions", []):
                if revision.get("id") == active_revision_id:
                    dep["revision"] = deepcopy(revision)
                    break
        return state

    def _persist(self) -> None:
        if not self._persist_path:
            return
        path = Path(self._persist_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        with open(tmp, "w") as f:
            json.dump(self._state, f, indent=2)
        tmp.replace(path)

    # Read helpers — return deep copies so callers can't mutate state without
    # going through the store.
    def models(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["models"])

    def gpu_types(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["gpu_types"])

    def api_keys(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["api_keys"])

    def get_api_key(self, key_id: str) -> dict | None:
        with self._lock:
            for k in self._state["api_keys"]:
                if k["id"] == key_id:
                    return deepcopy(k)
            return None

    def add_api_key(self, key: dict) -> None:
        with self._lock:
            self._state["api_keys"].append(key)
            self._persist()

    def update_api_key(self, key_id: str, patch: dict) -> dict | None:
        with self._lock:
            for k in self._state["api_keys"]:
                if k["id"] == key_id:
                    k.update(patch)
                    self._persist()
                    return deepcopy(k)
            return None

    def deployments(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["deployments"])

    def get_deployment(self, dep_id: str) -> dict | None:
        with self._lock:
            for d in self._state["deployments"]:
                if d["id"] == dep_id:
                    return deepcopy(d)
            return None

    def deployment_revisions(self, dep_id: str) -> list[dict] | None:
        with self._lock:
            for d in self._state["deployments"]:
                if d["id"] == dep_id:
                    return deepcopy(d.get("revisions", []))
            return None

    def add_deployment(self, dep: dict) -> None:
        with self._lock:
            self._state["deployments"].append(dep)
            self._persist()

    def update_deployment(self, dep_id: str, patch: dict) -> dict | None:
        with self._lock:
            for d in self._state["deployments"]:
                if d["id"] == dep_id:
                    d.update(patch)
                    self._persist()
                    return deepcopy(d)
            return None

    def add_deployment_revision(self, dep_id: str, revision: dict, deployment_patch: dict) -> dict | None:
        with self._lock:
            for d in self._state["deployments"]:
                if d["id"] != dep_id:
                    continue
                for existing_revision in d.setdefault("revisions", []):
                    if existing_revision.get("status") == "running":
                        existing_revision["status"] = "stopped"
                        existing_revision["endpoint_url"] = None
                        existing_revision["updated_at"] = revision["created_at"]
                        existing_revision["deactivated_at"] = revision["created_at"]
                d["revisions"].append(revision)
                d["active_revision_id"] = revision["id"]
                d["revision"] = deepcopy(revision)
                d.update(deployment_patch)
                self._state.setdefault("deployment_logs", {}).pop(dep_id, None)
                self._persist()
                return deepcopy(d)
            return None

    def update_active_revision(self, dep_id: str, patch: dict) -> dict | None:
        with self._lock:
            for d in self._state["deployments"]:
                if d["id"] != dep_id:
                    continue
                active_revision_id = d.get("active_revision_id")
                for revision in d.get("revisions", []):
                    if revision["id"] == active_revision_id:
                        revision.update(patch)
                        d["revision"] = deepcopy(revision)
                        self._persist()
                        return deepcopy(revision)
                return None

    def ensure_deployment_logs(self, dep_id: str, logs: list[dict]) -> list[dict]:
        with self._lock:
            deployment_logs = self._state.setdefault("deployment_logs", {})
            if dep_id not in deployment_logs:
                deployment_logs[dep_id] = logs
                self._persist()
            return deepcopy(deployment_logs[dep_id])

    def usage_daily(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["usage"]["daily"])


store = Store()
