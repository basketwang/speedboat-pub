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
                return json.load(f)
        with open(SEED_PATH) as f:
            return json.load(f)

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

    def usage_daily(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._state["usage"]["daily"])


store = Store()
