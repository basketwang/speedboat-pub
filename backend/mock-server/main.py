"""Speedboat mock backend.

A FastAPI app that mirrors the shape of the Parasail API closely enough that
candidates can build a real product against it. Behaviors worth knowing:

- Every endpoint sleeps for a jittered MOCK_LATENCY_MIN_MS..MAX_MS so the UI
  has to handle real loading states.
- Streaming endpoints (chat completions, deployment logs) emit chunks at
  realistic intervals.
- Error injection: pass `?_simulate=429` (or 401, 403, 500, 503) on any
  request, or set `X-Simulate-Status: 429` as a header, to force that
  response. Helps candidates exercise error UI without hacking the mock.
- All state is in-memory; set MOCK_PERSIST_PATH to persist across restarts.
"""
from __future__ import annotations

import asyncio
import os
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import auth_middleware
from routes import api_keys, chat, deployments, gpu_types, models, usage

LATENCY_MIN_MS = int(os.getenv("MOCK_LATENCY_MIN_MS", "50"))
LATENCY_MAX_MS = int(os.getenv("MOCK_LATENCY_MAX_MS", "300"))

# Endpoints that stream. We skip the artificial latency middleware on these so
# the streaming starts immediately — the chunks themselves carry the timing.
STREAMING_PREFIXES = ("/v1/chat/completions", "/v1/deployments/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Touch the store so seed loading happens at startup, not on first request.
    from store import store  # noqa: F401
    yield


app = FastAPI(
    title="Parasail API (mock)",
    version="0.1.0",
    description=(
        "Mock backend for the Speedboat take-home. Mirrors the shape of the "
        "Parasail API. See /docs for interactive Swagger UI."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def simulate_latency_and_errors(request: Request, call_next):
    # Error injection — query string OR header.
    sim = request.query_params.get("_simulate") or request.headers.get(
        "x-simulate-status"
    )
    if sim:
        try:
            code = int(sim)
        except ValueError:
            code = 500
        return JSONResponse(
            status_code=code,
            content={
                "error": {
                    "type": "simulated_error",
                    "code": code,
                    "message": f"Simulated {code} response (injected by client).",
                }
            },
        )

    # Skip artificial latency on streaming endpoints.
    if not any(
        request.url.path.startswith(p) and request.url.path != "/v1/deployments"
        for p in STREAMING_PREFIXES
    ):
        delay_ms = random.randint(LATENCY_MIN_MS, LATENCY_MAX_MS)
        await asyncio.sleep(delay_ms / 1000)

    return await call_next(request)


# Registered AFTER the latency/error middleware so it runs FIRST in the request
# path (Starlette wraps middleware in reverse-of-registration order). Order:
# auth → error-injection/latency → handler. Auth bypasses on `_simulate` so
# error-injection still wins for candidates testing error UI.
app.middleware("http")(auth_middleware)


@app.get("/healthz", tags=["meta"])
async def healthz():
    return {"status": "ok"}


app.include_router(models.router)
app.include_router(chat.router)
app.include_router(api_keys.router)
app.include_router(usage.router)
app.include_router(gpu_types.router)
app.include_router(deployments.router)
