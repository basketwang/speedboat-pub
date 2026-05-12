"""Model deployments.

POST /v1/deployments creates a deployment in `pending` status. Subsequent
GETs progress it through queued -> pulling_image -> loading_weights ->
warming_up -> running, advancing on each call so the UI sees real status
transitions without a background job.

GET /v1/deployments/:id/logs streams synthetic deploy logs as SSE.
"""
from __future__ import annotations

import asyncio
import json
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
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


@router.get("/deployments")
async def list_deployments():
    return {"object": "list", "data": store.deployments()}


@router.post("/deployments", status_code=201)
async def create_deployment(req: CreateDeploymentRequest):
    if req.gpu_type not in VALID_GPU_IDS():
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": (
                        f"Unknown gpu_type '{req.gpu_type}'. Call GET /v1/gpu-types."
                    ),
                }
            },
        )
    if req.autoscaling.max < req.autoscaling.min:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": "autoscaling.max must be >= autoscaling.min.",
                }
            },
        )
    if req.replicas < req.autoscaling.min or req.replicas > req.autoscaling.max:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_argument",
                    "message": "`replicas` must be within [autoscaling.min, autoscaling.max].",
                }
            },
        )

    dep_id = _new_deployment_id()
    record = {
        "id": dep_id,
        "name": req.name,
        "model_source": req.model_source,
        "gpu_type": req.gpu_type,
        "replicas": req.replicas,
        "autoscaling": req.autoscaling.model_dump(),
        "env": req.env,
        "status": "pending",
        "endpoint_url": None,
        "created_at": _now(),
        "updated_at": _now(),
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
        patch: dict = {"status": next_status, "updated_at": _now()}
        if next_status == "running":
            patch["endpoint_url"] = f"https://dep-{existing['name']}.parasail.io/v1"
        existing = store.update_deployment(dep_id, patch) or existing

    return existing


@router.delete("/deployments/{dep_id}")
async def delete_deployment(dep_id: str):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )
    store.update_deployment(
        dep_id, {"status": "deleted", "updated_at": _now(), "endpoint_url": None}
    )
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


@router.get("/deployments/{dep_id}/logs")
async def stream_deployment_logs(dep_id: str):
    existing = store.get_deployment(dep_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Deployment not found."}},
        )

    async def gen():
        for level, template in LOG_SCRIPT:
            line = template.format(**existing)
            payload = {
                "ts": _now(),
                "level": level,
                "deployment_id": dep_id,
                "message": line,
            }
            yield "event: log\ndata: " + json.dumps(payload) + "\n\n"
            await asyncio.sleep(0.4)
        # Mark stream end so clients can close cleanly.
        yield "event: end\ndata: " + json.dumps({"deployment_id": dep_id}) + "\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
