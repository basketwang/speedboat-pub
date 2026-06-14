# Architecture notes

## At a glance

- **Path(s) shipped:** Path 3, Model Deployment Wizard.
- **Stack (frontend, backend, DB, hosting):** Next.js, React, TypeScript, plain CSS, a thin Next.js API proxy, and the FastAPI mock server. No real DB; the mock stores deployment state in memory with optional file persistence.
- **What's available via preview URL vs local-only:** Local-only. Run the mock with Docker Compose and the frontend with `pnpm dev`.
- **Estimated production-readiness, 1-10:** 5. The core user flow, validation, async status, logs, retry, and observability stub are credible. Real auth, tenancy, persistent storage, API contracts, and hosted infrastructure are intentionally not production-complete.

## Architecture diagram

```text
[developer]
    |
    v
[Next.js React app]
    |  same-origin fetch, X-Correlation-Id
    v
[Next.js /api/parasail proxy]
    |  server-side bearer token, no-store proxying
    v
[FastAPI mock server]
    |-- /v1/models
    |-- /v1/gpu-types
    |-- /v1/deployments
    |-- /v1/deployments/:id/revisions
    `-- /v1/deployments/:id/logs (SSE)

[dev observability drawer]
    ^
    | structured frontend events, request metrics, product metrics
```

## Auth

- **Identity:** I kept the mock API key model. The frontend never asks the user for a key; browser calls go to a same-origin Next.js proxy.
- **Token storage / refresh:** The proxy reads `PARASAIL_API_KEY` server-side and attaches `Authorization: Bearer ...` when forwarding requests. No browser token storage or refresh flow is implemented.
- **What happens on 401:** It is surfaced as an API error through the shared request wrapper. The UI shows user-facing errors where requests are tied to an action, but there is no login redirect or token refresh story.
- **What I'd do differently in production:** Use an identity provider such as WorkOS/Auth0/Clerk or first-party OIDC, model org membership explicitly, keep Parasail API credentials server-side, and map 401/403 into a real session-expired or permission-denied flow.

## Data model

- **Tenancy model (org -> user -> resource):** Not implemented. The production shape would be `orgs -> users -> deployments -> revisions -> executions`. A deployment is the stable named endpoint. A revision is a configuration snapshot. An execution is a concrete deploy run for a revision.
- **What lives in the browser vs the server:** Browser state holds the current view, form draft, recent logs cached per deployment/revision in `sessionStorage`, and in-memory observability events. The mock server owns deployment records, active revision, historical revisions/executions, generated endpoint URL, and resumable log buffers.
- **Migrations / schema-evolution story:** The mock has a small migration path in `store.py` that backfills revision/execution fields for seeded deployments. Production would need explicit migrations, immutable revision records, and auditable execution records.

Current deployment shape, simplified:

```ts
Deployment {
  id, name, status, endpoint_url,
  model_source, gpu_type, replicas, autoscaling, env,
  active_revision_id,
  revision,
  revisions[]
}

DeploymentRevision {
  id, deployment_id, version,
  deployment_run_id,
  created_at, started_at, finished_at, deactivated_at,
  status,
  model_source, gpu_type, replicas, autoscaling, env
}
```

## State management

- **Client-side state choice:** I used local React state and derived values with `useMemo`. The app is small enough that introducing Redux, Zustand, or React Query would add more surface area than it removes. The same-origin API helpers keep data access centralized.
- **Server-side caching or invalidation:** The proxy uses `cache: "no-store"`. Deployment detail polling refreshes the active deployment. Revision history is loaded separately and merged defensively so a thinner active-revision response does not erase richer history fields.
- **What I'd change at 10x:** Add a query/cache layer such as TanStack Query for request dedupe, background refresh, mutation invalidation, and standard stale/error states.

## Error & resilience

- **Where the retry boundary lives:** The retry boundary is around create-deployment submission. `withRetry` retries retriable API errors with exponential backoff. It retries `429`, `500`, `502`, `503`, and `504`, but does not retry validation or conflict errors such as `400` or `409`.
- **What happens when a stream drops mid-request:** SSE logs are resumable. The backend emits `sequence` IDs; the frontend stores recent logs in `sessionStorage` by deployment and active revision, dedupes by sequence, and reconnects with `after` / `Last-Event-ID`.
- **What happens when the mock returns 429/503:** Create deployment uses up to three attempts with delays of 700ms and 1400ms. Retry scheduling is emitted as an observability event. If all attempts fail, the form remains intact and the user sees the final error.
- **What I'd add for production:** Request cancellation by operation, jittered backoff, server-side idempotency keys for create/update, rate-limit headers surfaced in UI, and integration tests around partial failure.

## Observability

- **Logs:** The frontend emits structured events to `console.info("[speedboat:event]", event)` and the dev-only observability drawer. Events include name, timestamp, correlation ID, and structured fields.
- **Metrics:** The drawer splits metrics into system and product signals. System metrics include request count, request errors, error rate, average latency, p95 latency, retries, log disconnects, and trace/correlation count. Product metrics include deployment starts, successes, failures, success rate, deployment duration, and revision update outcomes.
- **Traces:** This is a tracing stub rather than full OpenTelemetry. Meaningful operations create correlation IDs such as `deploy_...`, `detail_...`, and `api_...`; API calls forward them as `X-Correlation-Id`.
- **What I'd alert on first:** Create-deployment failure rate, p95 create latency, SSE disconnect rate, repeated retry exhaustion, and mismatch between deployment status and log stream health.

## Tradeoffs I'd defend

1. **One-page progressive form instead of a stepper.** The original path described a multi-step wizard, but one flow with source, hardware and runtime settings are more intuitive and simpler. I made later sections appear only after a valid model so the page stays guided without feeling slow.
2. **Thin BFF proxy instead of browser-to-mock direct calls.** The proxy keeps the bearer token server-side, avoids CORS concerns, and gives one place to propagate correlation IDs.
3. **Observability stub instead of real vendor integration.** The assignment explicitly did not require a Datadog account. I focused on the event shape, correlation IDs, and actionable metrics so the integration point is credible without adding setup friction.
4. **In-memory revision/execution history.** It proves the product model and UX without turning the take-home into a database exercise. I documented the production data shape and migration path rather than pretending the mock is durable.

## What I'd build next

- Real auth and org-scoped tenancy with permission checks on every deployment/revision/execution.
- Persistent execution history with idempotency keys, rollback, and diffing between revisions.
- A production observability sink: OpenTelemetry traces, structured backend logs, and dashboards/alerts for deployment health.
- More complete resilience: jittered retries, optimistic concurrency, and explicit failed/stopped deployment states driven by backend jobs.
