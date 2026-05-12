# Path 3 — Model Deployment Wizard

A guided flow that takes a developer from "I want to deploy this Hugging
Face model" to "here's a live endpoint" without surprises along the way.

> **API status: future-state.** The endpoints this path uses
> (`/v1/deployments`, `/v1/gpu-types`, deployment logs) do **not** exist
> in the real Parasail API today. The mock implements them so you can
> design the flow we'd ship. Available to the **Senior** track only —
> the async/streaming UX bar is too high for the Mid/Junior brief.

## Why this exists

Deploying a model on dedicated GPUs has too many decisions for one form:
which GPU, how many replicas, autoscaling shape, env vars, expected cost.
Today many products dump that complexity straight onto the user. Done well,
a wizard absorbs the complexity and surfaces only the choices that matter
for the task at hand.

## What you're building

A multi-step, guided deployment flow:

**Step 1 — Source.** Paste a Hugging Face URL or `org/repo` id. Validate
shape; show the parsed name; show a (mocked) recommended GPU type so the
user understands they're being helped.

**Step 2 — Hardware.** Pick a GPU type (`GET /v1/gpu-types` for the list
including hourly cost). Show estimated cost at the bottom of the screen as
the user changes settings — replicas × hourly_cost × 24 × 30 ≈ ballpark
monthly.

**Step 3 — Configuration.** Replicas, autoscaling (min, max,
target_concurrency), and env vars. Validate `min ≤ replicas ≤ max`. Don't
let the user submit something the API will reject.

**Step 4 — Review & deploy.** Summary card. One button. On submit, POST
the deployment, then take the user to a status page that:

- Polls `GET /v1/deployments/:id` and renders the status transitions
  (`pending` → `queued` → `pulling_image` → `loading_weights` →
  `warming_up` → `running`).
- Tails logs from `GET /v1/deployments/:id/logs` (SSE).
- Shows the endpoint URL the moment it appears.
- Handles errors gracefully — what happens if the deploy fails partway?

A separate list page showing all deployments with their current status is
expected too — it's the place users land on a return visit.

## Example user stories

- *"As a dev deploying my first model, I paste a Hugging Face URL and the
  wizard tells me which GPU to start with, what it'll cost roughly, and
  what happens next."*
- *"As an experienced dev, I skip past the recommendations, set autoscaling
  exactly the way I want it, and ship in under a minute."*
- *"As a dev waiting on a deploy, I watch the logs stream in real time and
  know exactly which step is taking time."*

## Endpoints you'll use

| Method | Path | What for |
|---|---|---|
| GET | `/v1/gpu-types` | List GPU types + hourly cost |
| POST | `/v1/deployments` | Create deployment |
| GET | `/v1/deployments` | List existing deployments |
| GET | `/v1/deployments/:id` | Status (advances on each poll) |
| GET | `/v1/deployments/:id/logs` | SSE log stream |
| DELETE | `/v1/deployments/:id` | Tear down |

A full request payload example is at
[`examples/payloads/deploy-model.json`](../../examples/payloads/deploy-model.json).

## Example request

```bash
curl -X POST http://localhost:3001/v1/deployments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "name": "llama-coder-dev",
    "model_source": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "gpu_type": "a100",
    "replicas": 1,
    "autoscaling": {"min": 1, "max": 2, "target_concurrency": 4},
    "env": {"VLLM_ENGINE_ARGS": "--max-model-len 16384"}
  }'
```

## What we're testing

- **Complex-flow design.** Stepper UX, progress indication, back/forward
  without losing state.
- **Validation.** Catch bad input client-side before the API does — but
  also handle API rejections without confusing the user.
- **Async progress UX.** Status polling, SSE log streaming, the moment
  the endpoint URL appears.
- **Error handling.** Network drop mid-stream, deploy that fails late,
  partial state on retry.
- **"Make complexity feel simple."** This is the central test of the
  path. Strong defaults, clear language, every screen earning its space.

## Stretch ideas (only if you have time)

- Live cost preview as the user changes hardware/replicas.
- Saved templates (e.g., "Llama 70B production preset").
- Side-by-side deploy diffs (vs an existing deployment).
- Region picker (multi-region is mocked; assume one for now).
- Rollback flow on the deployment detail page.

## Notes on the mock

- Each `GET /v1/deployments/:id` advances the deployment one status step.
  Drive the status UI by polling, the same way a real client would.
- `DELETE /v1/deployments/:id` flips the status to `deleted`; subsequent
  GETs do not advance further.
- `?_simulate=503` on the create endpoint is a useful way to test the
  retry path before a real backend ever rejects a deploy.
- Validation: the mock rejects invalid GPU types, names with uppercase
  characters, and out-of-range replica counts. Build for those errors.
