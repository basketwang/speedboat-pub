"""API key management.

NOTE: This is a *mock-only future-state* surface. The real Parasail API
does not currently expose key CRUD over HTTP — keys are managed out-of-
band. The take-home includes this so candidates can prototype the
dashboard the team plans to ship.

Real-shape behavior the mock honors:
- Issued tokens follow the real `psk-<accesskey>-<secretkey>` format —
  the same format the mock's auth middleware validates.
- The full secret is returned ONLY once, at creation time. After that
  responses only carry prefix + last_four.
- Revocation is a soft delete (sets revoked_at). Revoked keys still
  appear in list responses unless ?include_revoked=false.
"""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from store import store

router = APIRouter(prefix="/v1", tags=["api-keys"])


VALID_SCOPES = {
    "inference:read",
    "inference:write",
    "deployments:read",
    "deployments:write",
    "billing:read",
    "billing:write",
    "admin",
}


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=lambda: ["inference:read"])
    spend_limit_usd: float | None = Field(
        default=None,
        description="Hard cap on total spend for this key, in USD. Null = unlimited.",
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def _new_key_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "key_" + "".join(secrets.choice(alphabet) for _ in range(26))


def _new_secret() -> tuple[str, str, str]:
    """Returns (full_secret, prefix, last_four).

    Token format mirrors the real Parasail API: `psk-<accesskey>-<secretkey>`.
    The auth middleware validates this exact shape; mock-issued keys are
    valid against it.
    """
    alphabet = string.ascii_letters + string.digits
    accesskey = "".join(secrets.choice(alphabet) for _ in range(10))
    secretkey = "".join(secrets.choice(alphabet) for _ in range(32))
    full = f"psk-{accesskey}-{secretkey}"
    prefix = f"psk-{accesskey}-"
    return full, prefix, secretkey[-4:]


@router.get("/api-keys")
async def list_api_keys(include_revoked: bool = Query(True)):
    keys = store.api_keys()
    if not include_revoked:
        keys = [k for k in keys if k.get("revoked_at") is None]
    return {"object": "list", "data": keys}


@router.post("/api-keys", status_code=201)
async def create_api_key(req: CreateApiKeyRequest):
    bad = [s for s in req.scopes if s not in VALID_SCOPES]
    if bad:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "type": "invalid_scope",
                    "message": f"Unknown scope(s): {bad}. Valid scopes: {sorted(VALID_SCOPES)}",
                }
            },
        )

    full, prefix, last_four = _new_secret()
    record = {
        "id": _new_key_id(),
        "name": req.name,
        "prefix": prefix,
        "last_four": last_four,
        "scopes": req.scopes,
        "spend_limit_usd": req.spend_limit_usd,
        "spend_used_usd": 0.0,
        "created_at": _now(),
        "last_used_at": None,
        "revoked_at": None,
    }
    store.add_api_key(record)
    # The full secret is only returned at creation time.
    return {**record, "secret": full}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str):
    existing = store.get_api_key(key_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Key not found."}},
        )
    if existing.get("revoked_at"):
        return existing
    return store.update_api_key(key_id, {"revoked_at": _now()})


class UpdateApiKeyRequest(BaseModel):
    name: str | None = None
    spend_limit_usd: float | None = None
    scopes: list[str] | None = None


@router.patch("/api-keys/{key_id}")
async def update_api_key(key_id: str, req: UpdateApiKeyRequest):
    existing = store.get_api_key(key_id)
    if not existing:
        raise HTTPException(
            status_code=404,
            detail={"error": {"type": "not_found", "message": "Key not found."}},
        )
    patch: dict = {}
    if req.name is not None:
        patch["name"] = req.name
    if req.spend_limit_usd is not None:
        patch["spend_limit_usd"] = req.spend_limit_usd
    if req.scopes is not None:
        bad = [s for s in req.scopes if s not in VALID_SCOPES]
        if bad:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "type": "invalid_scope",
                        "message": f"Unknown scope(s): {bad}",
                    }
                },
            )
        patch["scopes"] = req.scopes
    if not patch:
        return existing
    return store.update_api_key(key_id, patch)
