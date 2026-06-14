# NOTES

## Path(s) chosen

Path 3: Model Deployment Wizard.

## Total time spent

~7 hours including design iteration, backend mock extensions, frontend implementation, verification, and documentation.

## Production-shape extension I built

- **Observability hooks**, with a small Datadog/OpenTelemetry-style stub:
  - structured frontend events
  - correlation IDs propagated through API calls
  - system metrics for request count, error rate, latency, retries, and log disconnects
  - product metrics for deployment starts, successes, failures, success rate, duration, and revision update outcomes
  - a dev-only observability drawer

I also built part of the resilience extension: retry/backoff for create-deployment failures, plus resumable SSE logs.

## Production concerns I'd tackle next

- **Real auth and multi-tenancy.** This should come before any real customer data ships. The production model should be org -> user -> deployment -> revision -> execution, with permissions enforced server-side.
- **Persistent deployment execution storage.** The mock stores history in memory. A real system needs durable execution records, idempotency keys, auditability, and migration-safe schemas.

## Stack

- **Frontend:** Next.js, React, TypeScript, plain CSS.
- **Backend (if any beyond the mock):** Thin Next.js API proxy; FastAPI mock server extended for revisions, executions, and resumable logs.
- **DB:** None. Mock server in-memory state with optional `MOCK_PERSIST_PATH`.
- **Local run command:**
  - Mock: `docker compose up`
  - Frontend: `cd frontend && pnpm install && pnpm dev`
- **Hosting / preview URL, if any:** None. Local path is the supported review path.
- **Auth provider / approach:** Mock API key kept server-side in the Next.js proxy via `PARASAIL_API_KEY`.
- **Observability tool (or stub):** Local structured-event stub with correlation IDs, console logs, in-memory metrics, and dev-only drawer.

## AI tools used

Codex was used heavily as a pair-programming agent for code edits, iteration, and verification. It helped most with fast UI iteration, wiring frontend/backend changes together, and keeping repetitive validation/build checks moving. I reviewed and steered product language, architecture choices, and tradeoffs throughout, especially around the deployment/revision/execution model and the observability metrics split.

## What I cut, and why

- **Real auth.** Important, but it would have competed with the core deployment UX and observability extension.
- **Real database / persistence layer.** The assignment mock was enough to prove the workflow. I documented the production data model instead of spending the time on plumbing.
- **Hosted preview.** I prioritized a cleaner local flow and deeper product iteration over deployment setup.
- **Full OpenTelemetry integration.** The take-home asks for a tool or stub. I built the event/metric shape and correlation propagation without requiring external accounts.

## What breaks at 10x / 100x

- **First thing that breaks:** client-side polling and in-memory state. With many users and deployments, polling every detail page does unnecessary work and the mock's in-memory state cannot be trusted.
- **Second:** observability stored only in browser memory. It is useful for a take-home/dev drawer, but not enough for cross-user incident response.
- **What I'd do about it:** move deployment state into durable storage, drive status from backend jobs/events, replace polling with a scalable subscription strategy where appropriate, and ship structured logs/metrics/traces to a real observability backend.

## Anything you want a reviewer to know

Start with the deployment detail page. The main product model is:

- **Deployment:** stable named endpoint.
- **Revision:** immutable configuration snapshot.
- **Execution:** one deployment run for a revision.

The backend mock was extended to support revision history, execution IDs, deactivation timestamps, new revision creation, and resumable log streaming. The frontend intentionally presents a technical, dense workflow rather than a marketing-style wizard.

## Feedback on this take-home (optional)

N/A
