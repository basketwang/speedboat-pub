# Senior Take-Home Implementation Plan

## Chosen path

**Path 3: Model Deployment Wizard**

Build a guided flow that takes a developer from a Hugging Face model source to a running Parasail deployment, with clear cost expectations, validation, async progress, and deployment logs.

## Product goal

Make dedicated model deployment feel understandable and safe. A developer should be able to paste a model id, accept sensible defaults, understand the cost shape, deploy, and watch progress without wondering whether the system is stuck.

## Senior signal

This project should show end-to-end senior IC judgment:

- A polished, task-focused UI rather than a generic demo.
- Defensive client-side validation before API submission.
- Async state management for polling and SSE logs.
- Clear error states and retry behavior.
- Production-shaped observability hooks with correlation IDs and structured events.
- Written tradeoffs that explain what was built, what was intentionally cut, and what would change at 10x scale.

## Success criteria

The submission is successful when a reviewer can:

- Open the app locally with clear instructions.
- See a list of existing deployments.
- Start a new deployment through a multi-step wizard.
- Paste a Hugging Face URL or `org/repo` model id and see it parsed.
- Choose a GPU type from `GET /v1/gpu-types`.
- Configure replicas, autoscaling, and environment variables.
- See a live monthly cost estimate.
- Submit a deployment with `POST /v1/deployments`.
- Land on a deployment detail page.
- Watch status progress through polling `GET /v1/deployments/:id`.
- Tail logs from `GET /v1/deployments/:id/logs`.
- See the endpoint URL once the deployment reaches `running`.
- Experience useful loading, empty, validation, and failure states.

## Stack

- **Frontend:** Next.js + React + TypeScript
- **Styling:** Plain CSS with a small local design system
- **Backend:** Existing FastAPI mock server
- **API base URL:** Configurable through environment variables, proxied by Next.js
- **Persistence:** Mock server persistence only; browser state for temporary wizard state if useful
- **Production extension:** Observability and resilience

## User flow

1. **Deployment list**
   - Default landing view.
   - Shows existing deployments, status, GPU type, replicas, and endpoint when available.
   - Empty state leads directly to the wizard.

2. **New deployment wizard**
   - Step 1: Source
     - Accept Hugging Face URL or `org/repo`.
     - Parse and display model owner/name.
     - Recommend a starter GPU.
   - Step 2: Hardware
     - Fetch GPU types from the mock.
     - Show hourly and estimated monthly cost.
     - Let the user choose a GPU type.
   - Step 3: Configuration
     - Configure replicas.
     - Configure autoscaling min, max, and target concurrency.
     - Add environment variables.
     - Validate `min <= replicas <= max`.
   - Step 4: Review and deploy
     - Summarize source, hardware, cost, autoscaling, and env vars.
     - Submit with a single primary action.

3. **Deployment detail**
   - Poll deployment status until terminal state.
   - Render status progression.
   - Stream logs with SSE.
   - Show endpoint URL once available.
   - Allow deletion if time permits.

## Production-shape extension

### Observability hooks

Implement a small observability layer that emits structured client-side events. For the take-home, these can log to the browser console and an in-app diagnostics panel. In production, the same event shape could route to Datadog, Sentry, OpenTelemetry, or a backend collector.

Events to emit:

- `deployment.create.started`
- `deployment.create.succeeded`
- `deployment.create.failed`
- `deployment.poll.started`
- `deployment.poll.failed`
- `deployment.logs.connected`
- `deployment.logs.disconnected`
- `deployment.retry.scheduled`

Each event should include:

- correlation ID
- deployment ID when known
- route or screen
- elapsed time when relevant
- error status/message when relevant

### Resilience

Handle mock failures as real product behavior:

- Use `?_simulate=503` to test create-deployment failures.
- Add retry/backoff for retriable deployment create failures.
- Show retry progress clearly.
- Stop after a small maximum retry count.
- Preserve the user's wizard input when submission fails.
- Treat validation errors as user-fixable, not system failures.

## Implementation phases

### Phase 1: Frontend scaffold

- Create `frontend/` with Next.js, React, and TypeScript.
- Add app shell, routing-like view state, global CSS, and environment config.
- Add API client helpers and a thin same-origin proxy for mock endpoints.

### Phase 2: Deployment list and wizard golden path

- Build deployment list.
- Build wizard step components.
- Fetch GPU types.
- Validate source and autoscaling.
- POST deployment.

### Phase 3: Async deployment detail

- Add polling for deployment status.
- Add SSE log streaming.
- Render status timeline and endpoint URL.
- Handle stream disconnects.

### Phase 4: Observability and resilience

- Add correlation IDs.
- Add structured event logging.
- Add retry/backoff for create failures.
- Add visible error and retry states.
- Add a dev-only error simulation control if time allows.

### Phase 5: Polish and documentation

- Tighten responsive layout.
- Add empty/loading/error states.
- Fill out `architecture-notes.md`.
- Fill out `NOTES.md`.
- Verify local run instructions.

## Cut line

These are intentionally out of scope unless the core flow is already strong:

- Real authentication.
- Real database.
- Real Parasail deployment backend.
- Multi-region deployments.
- Saved deployment templates.
- Rollback flow.
- Team/org management.
- Full audit log.

## Risks

- **SSE complexity:** Log streaming can be fiddly. Keep the parser small and test against the mock early.
- **Wizard sprawl:** Avoid turning each step into a settings page. Keep defaults strong.
- **Overbuilding observability:** The goal is credible event shape and instrumentation points, not a full telemetry platform.
- **Visual polish time:** Prioritize a clean, dense developer-tool interface over decorative design.

## Reviewer narrative

The story to tell in the live session:

> I chose the deployment wizard because it exercises complex workflow design, async backend state, validation, and production-shaped failure handling. I kept the backend as the provided mock so I could spend time on the product surface and resilience. The production extension is observability plus retry behavior, because deployment workflows are exactly where operators need correlation IDs, clear progress, and debuggable failures.
