"""Auth middleware for the mock server.

Mirrors the real Parasail API: every non-meta request must carry
`Authorization: Bearer psk-<accesskey>-<secretkey>`. The mock validates
only the *format* of the token — it doesn't look up keys against a DB.
That's enough for candidate code written against the mock to keep working
when `PARASAIL_BASE_URL` flips to production: the same client code passes
a real `psk-...-...` key that the real auth filter validates against its
database.
"""
from __future__ import annotations

import re

from fastapi import Request
from fastapi.responses import JSONResponse

# Three dash-separated parts: literal `psk`, accesskey, secretkey.
TOKEN_PATTERN = re.compile(r"^psk-[A-Za-z0-9_]+-[A-Za-z0-9_]+$")

# Paths that bypass auth — interactive docs, healthcheck, the OpenAPI JSON
# Swagger UI fetches.
AUTH_BYPASS_PREFIXES = ("/healthz", "/docs", "/redoc", "/openapi.json")


def _is_bypass_path(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in AUTH_BYPASS_PREFIXES)


def _is_simulating(request: Request) -> bool:
    # Error-injection takes precedence over auth so candidates can build
    # error UI without juggling tokens.
    return bool(
        request.query_params.get("_simulate")
        or request.headers.get("x-simulate-status")
    )


def _unauthorized(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={
            "error": {
                "type": "unauthorized",
                "code": 401,
                "message": message,
            }
        },
    )


async def auth_middleware(request: Request, call_next):
    if _is_bypass_path(request.url.path) or _is_simulating(request):
        return await call_next(request)

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return _unauthorized(
            "Missing or malformed Authorization header. Expected "
            "'Authorization: Bearer psk-<accesskey>-<secretkey>'."
        )

    token = header[7:].strip()
    if not TOKEN_PATTERN.match(token):
        return _unauthorized(
            "Invalid API key format. Expected three dash-separated parts: "
            "psk-<accesskey>-<secretkey>."
        )

    return await call_next(request)
