# Speedboat Deployment Wizard

Senior Full-Stack UI/UX take-home for Parasail Speedboat, focused on
Path 3: Model Deployment Wizard.

The project turns the starter mock API into a local deployment workflow:
a developer can browse existing deployments, create a new deployment from a
Hugging Face model source, choose hardware, configure runtime settings, watch
deployment progress, stream logs, and inspect revision history.

## What shipped

- A Next.js + React + TypeScript frontend in [frontend/](frontend/).
- A thin same-origin Next.js API proxy that keeps the Parasail bearer token
  server-side and forwards correlation IDs.
- FastAPI mock extensions for deployment CRUD, revision history, execution
  IDs, deactivation timestamps, and resumable SSE deployment logs.
- Client-side validation for model source, replica counts, autoscaling, and
  environment variables.
- Retry/backoff for retriable create-deployment failures.
- A dev-only observability drawer with structured events, correlation IDs,
  request/error/latency metrics, retry counts, log disconnects, and product
  deployment metrics.

## Run locally

Start the mock server from the repo root:

```bash
cp .env.example .env
docker compose up
```

In another terminal, start the frontend:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The mock backend runs at `http://localhost:3001`. Swagger UI is available at
`http://localhost:3001/docs`.

## Environment

Root `.env` controls the mock and shared Parasail API defaults:

```bash
PARASAIL_BASE_URL=http://localhost:3001
PARASAIL_API_KEY=psk-mock-mockkey
MOCK_LATENCY_MIN_MS=50
MOCK_LATENCY_MAX_MS=300
```

`frontend/.env.local` controls the frontend proxy:

```bash
PARASAIL_BASE_URL=http://localhost:3001
PARASAIL_API_KEY=psk-mock-mockkey
NEXT_PUBLIC_SPEEDBOAT_API_BASE_PATH=/api/parasail
```

Set `MOCK_PERSIST_PATH=/data/state.json` in the root `.env` to persist created
deployments across mock restarts. The Docker Compose file already mounts the
`mock-data` volume.

## Useful commands

```bash
# Frontend typecheck
cd frontend
pnpm typecheck

# Production build check
pnpm build

# Run the mock without Docker
cd ../backend/mock-server
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

## Product flow

1. The landing page shows existing deployments with status, GPU type, replicas,
   and endpoint information when available.
2. The new deployment flow accepts a Hugging Face URL or `org/repo` model ID.
3. GPU types are loaded from `GET /v1/gpu-types`; the UI shows hourly and
   estimated monthly cost.
4. Runtime configuration covers replicas, autoscaling, and environment
   variables.
5. Create submission posts to `POST /v1/deployments`, then opens the detail
   view.
6. The detail view polls `GET /v1/deployments/:id`, streams
   `GET /v1/deployments/:id/logs`, and shows the endpoint URL once running.
7. Revision history is available through `GET /v1/deployments/:id/revisions`.

## Architecture

```text
[Next.js React app]
    |
    | same-origin fetch, X-Correlation-Id
    v
[Next.js /api/parasail proxy]
    |
    | server-side bearer token, no-store proxying
    v
[FastAPI mock server]
    |-- /v1/models
    |-- /v1/gpu-types
    |-- /v1/deployments
    |-- /v1/deployments/:id/revisions
    `-- /v1/deployments/:id/logs

[dev observability drawer]
    ^
    | structured frontend events, request metrics, product metrics
```

The production data model I would carry forward is:

- **Deployment:** stable named endpoint.
- **Revision:** immutable configuration snapshot.
- **Execution:** one deployment run for a revision.

The mock stores this state in memory by default, with optional file persistence.
Production would need real auth, org-scoped tenancy, durable execution records,
idempotency keys, auditability, and migration-safe schemas.

## Mock server highlights

The mock supports:

- `GET /v1/models`
- `GET /v1/gpu-types`
- `GET /v1/deployments`
- `POST /v1/deployments`
- `GET /v1/deployments/:id`
- `PATCH /v1/deployments/:id`
- `DELETE /v1/deployments/:id`
- `GET /v1/deployments/:id/revisions`
- `GET /v1/deployments/:id/logs`
- `GET /v1/api-keys`, `POST /v1/api-keys`, `PATCH /v1/api-keys/:id`,
  `DELETE /v1/api-keys/:id`
- `GET /v1/usage`
- `POST /v1/spend-limits`
- `POST /v1/chat/completions`

Useful mock behavior:

- Artificial latency via `MOCK_LATENCY_MIN_MS` and `MOCK_LATENCY_MAX_MS`.
- Error injection with `?_simulate=429`, `?_simulate=503`, or
  `X-Simulate-Status`.
- Deployment progression driven by polling:
  `pending -> queued -> pulling_image -> loading_weights -> warming_up -> running`.
- Resumable log streaming with sequence IDs.

See [backend/mock-server/README.md](backend/mock-server/README.md) for mock
extension details.

## Review docs

- [docs/tracks/senior/NOTES.md](docs/tracks/senior/NOTES.md): time spent,
  stack, AI usage, cuts, and next production concerns.
- [docs/tracks/senior/architecture-notes.md](docs/tracks/senior/architecture-notes.md):
  auth, data model, state management, resilience, observability, and tradeoffs.
- [docs/tracks/senior/implementation-plan.md](docs/tracks/senior/implementation-plan.md):
  original implementation plan and success criteria.
- [frontend/README.md](frontend/README.md): frontend-specific setup notes.

## What I would build next

- Real auth and org-scoped tenancy with permission checks on every deployment,
  revision, and execution.
- Persistent deployment execution history with idempotency keys, rollback, and
  revision diffing.
- A production observability sink using OpenTelemetry traces, structured
  backend logs, and dashboards/alerts for deployment health.
- More complete resilience: jittered retries, optimistic concurrency, and
  explicit failed/stopped deployment states driven by backend jobs.
