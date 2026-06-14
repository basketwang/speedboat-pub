# Mock server

A FastAPI app that mirrors the Parasail API closely enough for the
take-home. Behaviors worth knowing if you want to extend it:

## What it gives you out of the box

- `GET /v1/models` — model catalog, including per-model
  `recommended_configuration` for deployment defaults.
- `POST /v1/chat/completions` — OpenAI-compatible, streaming via SSE when
  `stream: true`.
- `GET /v1/api-keys`, `POST /v1/api-keys`, `PATCH /v1/api-keys/:id`,
  `DELETE /v1/api-keys/:id` — list, create, update, revoke.
- `GET /v1/usage` — synthesized series with `granularity=day|hour`, optional
  `api_key_id` and `model` filters.
- `POST /v1/spend-limits` — account-wide or per-key spend caps + alert
  thresholds.
- `GET /v1/gpu-types`
- `GET /v1/deployments`, `POST /v1/deployments`, `GET /v1/deployments/:id`,
  `PATCH /v1/deployments/:id`, `DELETE /v1/deployments/:id` — full
  deployment CRUD. Patch creates a new deployment revision.
- `GET /v1/deployments/:id/revisions` — revision history for a deployment.
- `GET /v1/deployments/:id/logs` — SSE stream of synthetic deploy logs.
- `GET /healthz`
- `GET /docs` — interactive Swagger UI.
- `GET /openapi.json` — live OpenAPI spec served by FastAPI.

## Behaviors

- **Artificial latency.** Every non-streaming endpoint sleeps for a jittered
  `MOCK_LATENCY_MIN_MS..MAX_MS`. Default 50–300ms. So your UI has to render
  loading states.
- **Error injection.** Pass `?_simulate=429` (or `401`, `403`, `500`, `503`)
  on any endpoint, or set the `X-Simulate-Status` header. Lets you build and
  screenshot error UI without hacking the mock.
- **Persistence.** State is in-memory by default. Set `MOCK_PERSIST_PATH` to
  a file path and created keys / deployments survive restarts. The provided
  `docker-compose.yml` ships a `mock-data` volume mount ready for this.
- **Deployment progression.** A new deployment starts in `pending`. Each
  `GET /v1/deployments/:id` advances it one step
  (`pending` → `queued` → `pulling_image` → `loading_weights` →
  `warming_up` → `running`). No background job needed; the UI drives it by
  polling.
- **Streaming chat completions.** Word-ish chunks at ~30–60 tok/s feel.
  Canned responses chosen deterministically from the user's last message so
  the same prompt screenshots the same way.

## Run it locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

Then `http://localhost:3001/docs`.

## Extending the mock

- **Add a route**: drop a new file under `routes/`, define an
  `APIRouter(prefix="/v1", tags=[...])`, and `app.include_router(...)` it
  from `main.py`. The latency middleware applies automatically.
- **Add seed data**: edit `seed-data.json`. The `Store` class in `store.py`
  reads it on startup. If you've enabled persistence, delete the persisted
  state file to force a re-seed.
- **Add a streaming endpoint**: follow the patterns in `routes/chat.py`
  (SSE for chat) or `routes/deployments.py` (SSE for logs). The middleware
  skips artificial latency for paths starting with the prefixes listed in
  `STREAMING_PREFIXES` in `main.py`.

## Regenerating the OpenAPI spec + Postman collection

From the repo root:

```bash
python backend/mock-server/export_openapi.py > backend/openapi.yaml
python backend/mock-server/export_postman.py > backend/postman-collection.json
```

The committed `backend/openapi.yaml` and `backend/postman-collection.json`
are produced this way — re-run after changing any route.
