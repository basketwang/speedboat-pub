"""Model deployments.

POST /v1/deployments creates a deployment in `pending` status. Subsequent
GETs progress it through queued -> pulling_image -> loading_weights ->
warming_up -> running, advancing on each call so the UI sees real status
transitions without a background job.

GET /v1/deployments/:id/logs streams resumable synthetic deploy logs as SSE.
"""
from __future__ import annotations

import asyncio
import json
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from store import store

router = APIRouter(prefix="/v1", tags=["deployments"])


VALID_GPU_IDS = lambda: {g["id"] for g in store.gpu_types()}  # noqa: E731


class Autoscaling(BaseModel):
    min: int = Field(1, ge=0)
    max: int = Field(2, ge=1)
    target_concurrency: int = Field(8, ge=1)


class CreateDeploymentRequest(BaseModel):
    # Pydantic v2 reserves the `model_` namespace; opt out so the API can keep
    # the ergonomic `model_source` name.
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=1, max_length=63, pattern=r"^[a-z0-9][a-z0-9-]*$")
    model_source: str = Field(
        ...,
        description="Hugging Face URL or repo id, e.g. 'meta-llama/Meta-Llama-3.1-8B-Instruct'.",
    )
    gpu_type: str
    replicas: int = Field(1, ge=1, le=16)
    autoscaling: Autoscaling = Field(default_factory=Autoscaling)
    env: dict[str, str] = Field(default_factory=dict)


class UpdateDeploymentRequest(BaseModel):
    # Any provided config value creates a new deployment revision.
    model_config = ConfigDict(protected_namespaces=())

    model_source: str | None = None
    gpu_type: str | None = None
    replicas: int | None = Field(default=None, ge=1, le=16)
    autoscaling: Autoscaling | None = None
    env: dict[str, str] | None = None


# Each deployment progresses through these statuses, one step per GET.
STATUS_PROGRESSION = [
    "pending",
    "queued",
    "pulling_image",
    "loading_weights",
    "warming_up",
    "running",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def _new_deployment_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "dep_" + "".join(secrets.choice(alphabet) for _ in range(26))


def _new_revision_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "rev_" + "".join(secrets.choice(alphabet) for _ in range(26))


def _new_deployment_run_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "run_" + "".join(secrets.choice(alphabet) for _ in range(26))


def _validate_config(gpu_type: str, replicas: int, autoscaling: dict) -> None:
    if gpu_type not in VALID_GPU_IDS():
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": (
                        f"Unknown gpu_type '{gpu_type}'. Call GET /v1/gpu-types."
                    ),
                }
            },
        )
    if autoscaling["max"] < autoscaling["min"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": "autoscaling.max must be >= autoscaling.min.",
                }
            },
        )
    if replicas < autoscaling["min"] or replicas > autoscaling["max"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": "`replicas` must be within [autoscaling.min, autoscaling.max].",
                }
            },
        )


@router.get("/deployments")
async def list_deployments():
    return {"object": "list", "data": store.deployments()}


@router.post("/deployments", status_code=201)
async def create_deployment(req: CreateDeploymentRequest):
    autoscaling = req.autoscaling.model_dump()
    _validate_config(req.gpu_type, req.replicas, autoscaling)
    if any(
        deployment["name"].lower() == req.name.lower()
        for deployment in store.deployments()
        if deployment.get("status") != "deleted"
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "type": "conflict",
                    "message": "A deployment with this name already exists.",
                }
            },
        )

    dep_id = _new_deployment_id()
    now = _now()
    revision = {
        "id": _new_revision_id(),
        "deployment_run_id": _new_deployment_run_id(),
        "deployment_id": dep_id,
        "version": 1,
        "model_source": req.model_source,
        "gpu_type": req.gpu_type,
        "replicas": req.replicas,
        "autoscaling": autoscaling,
        "env": req.env,
        "status": "pending",
        "endpoint_url": None,
        "created_at": now,
        "started_at": None,
        "finished_at": None,
        "updated_at": now,
        "activated_at": None,
        "deactivated_at": None,
    }
    record = {
        "id": dep_id,
        "name": req.name,
        "active_revision_id": revision["id"],
        "revision": revision,
        "revisions": [revision],
        "model_source": req.model_source,
        "gpu_type": req.gpu_type,
        "replicas": req.replicas,
        "autoscaling": autoscaling,
        "env": req.env,
        "status": "pending",
        "endpoint_url": None,
        "created_at": now,
        "updated_at": now,
    }
    store.add_deployment(record)
    return record


@router.get("/deployments/{dep_id}")
async def get_deployment(dep_id: str):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )

    # Advance one status step per call until running. Final status sticks.
    if existing["status"] in STATUS_PROGRESSION and existing["status"] != "running":
        idx = STATUS_PROGRESSION.index(existing["status"])
        next_status = STATUS_PROGRESSION[min(idx + 1, len(STATUS_PROGRESSION) - 1)]
        now = _now()
        patch: dict = {"status": next_status, "updated_at": now}
        revision_patch: dict = {"status": next_status, "updated_at": now}
        if next_status == "queued" and not existing.get("revision", {}).get("started_at"):
            revision_patch["started_at"] = now
        if next_status == "running":
            endpoint_url = f"https://dep-{existing['name']}.parasail.io/v1"
            patch["endpoint_url"] = endpoint_url
            revision_patch["endpoint_url"] = endpoint_url
            revision_patch["activated_at"] = now
            revision_patch["finished_at"] = now
        store.update_active_revision(dep_id, revision_patch)
        existing = store.update_deployment(dep_id, patch) or existing

    return existing


@router.patch("/deployments/{dep_id}")
async def update_deployment(dep_id: str, req: UpdateDeploymentRequest):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )
    if not req.model_fields_set:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": "Provide at least one deployment config field to update.",
                }
            },
        )

    autoscaling = (
        req.autoscaling.model_dump()
        if req.autoscaling is not None
        else existing["autoscaling"]
    )
    model_source = req.model_source if req.model_source is not None else existing["model_source"]
    gpu_type = req.gpu_type if req.gpu_type is not None else existing["gpu_type"]
    replicas = req.replicas if req.replicas is not None else existing["replicas"]
    env = req.env if req.env is not None else existing.get("env", {})
    _validate_config(gpu_type, replicas, autoscaling)

    revisions = existing.get("revisions", [])
    next_version = max((revision.get("version", 0) for revision in revisions), default=0) + 1
    now = _now()
    revision = {
        "id": _new_revision_id(),
        "deployment_run_id": _new_deployment_run_id(),
        "deployment_id": dep_id,
        "version": next_version,
        "model_source": model_source,
        "gpu_type": gpu_type,
        "replicas": replicas,
        "autoscaling": autoscaling,
        "env": env,
        "status": "pending",
        "endpoint_url": existing.get("endpoint_url"),
        "created_at": now,
        "started_at": None,
        "finished_at": None,
        "updated_at": now,
        "activated_at": None,
        "deactivated_at": None,
    }
    deployment_patch = {
        "model_source": model_source,
        "gpu_type": gpu_type,
        "replicas": replicas,
        "autoscaling": autoscaling,
        "env": env,
        "status": "pending",
        "updated_at": now,
    }
    updated = store.add_deployment_revision(dep_id, revision, deployment_patch)
    return updated


@router.get("/deployments/{dep_id}/revisions")
async def list_deployment_revisions(dep_id: str):
    revisions = store.deployment_revisions(dep_id)
    if revisions is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )
    return {"object": "list", "data": revisions}


@router.delete("/deployments/{dep_id}")
async def delete_deployment(dep_id: str):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )
    now = _now()
    store.update_active_revision(
        dep_id, {"status": "deleted", "updated_at": now, "endpoint_url": None}
    )
    store.update_deployment(dep_id, {"status": "deleted", "updated_at": now, "endpoint_url": None})
    return {"id": dep_id, "deleted": True}


# ----- Streaming logs -----

LOG_SCRIPT = [
    ("info",  "scheduling deployment on gpu pool: {gpu_type}"),
    ("info",  "allocated {replicas} replica(s)"),
    ("info",  "pulling image registry.parasail.io/serving-runtime:0.42"),
    ("debug", "image layer 1/8 ... ok"),
    ("debug", "image layer 4/8 ... ok"),
    ("debug", "image layer 8/8 ... ok"),
    ("info",  "downloading weights from {model_source}"),
    ("debug", "shard 1/4 ... 23%"),
    ("debug", "shard 1/4 ... 67%"),
    ("debug", "shard 1/4 ... done"),
    ("debug", "shard 2/4 ... done"),
    ("debug", "shard 3/4 ... done"),
    ("debug", "shard 4/4 ... done"),
    ("info",  "loading weights into vLLM engine"),
    ("info",  "warming up: running 8 dummy completions"),
    ("info",  "endpoint ready at https://dep-{name}.parasail.io/v1"),
    ("info",  "deployment is now running"),
]


def _build_log_script(dep_id: str, deployment: dict) -> list[dict]:
    logs = []
    for index, (level, template) in enumerate(LOG_SCRIPT, start=1):
        logs.append(
            {
                "id": f"{dep_id}-log-{index:04d}",
                "sequence": index,
                "ts": _now(),
                "level": level,
                "deployment_id": dep_id,
                "message": template.format(**deployment),
            }
        )
    return logs


def _parse_last_event_id(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(value)
    except ValueError:
        return 0


@router.get("/deployments/{dep_id}/logs")
async def stream_deployment_logs(
    dep_id: str,
    after: int = Query(0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )
    after_sequence = max(after, _parse_last_event_id(last_event_id))
    logs = store.ensure_deployment_logs(dep_id, _build_log_script(dep_id, existing))

    async def gen():
        for payload in logs:
            if payload["sequence"] <= after_sequence:
                continue
            yield (
                f"id: {payload['sequence']}\n"
                "event: log\n"
                "data: "
                + json.dumps(payload)
                + "\n\n"
            )
            await asyncio.sleep(0.4)
        # Mark stream end so clients can close cleanly.
        yield (
            "event: end\n"
            "data: "
            + json.dumps({"deployment_id": dep_id, "after": after_sequence})
            + "\n\n"
        )

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
