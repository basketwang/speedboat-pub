# Speedboat Take-Home

Welcome — and thanks for spending the time on this.

## What Speedboat is

At Parasail Speedboat is the product engineering team responsible for everything customer-facing: the APIs, agents, developer tooling, billing, authentication, API key management, and overall user experience (for both humans and bots).

Our job is to take the powerful capabilities built by the core inference platform: LLM inference, fine-tuning, deployments, and vertical AI workloads like text-to-video and audio. Turn them into intuitive, polished product experiences that developers actually enjoy using.

We focus on moving fast at the product layer while staying lightweight and out of the way of the core inference engine underneath.

## Pick your track

There are three tracks. Your recruiter contact will have told you which
one to read. Each track folder has its own brief, deliverables list, and
NOTES template.

| Track | Persona | Brief |
|---|---|---|
| **Mid/Junior Full-Stack UI/UX** | Design-leaning IC. Shows design *thinking*, not just generated output. | [docs/tracks/mid-junior/README.md](docs/tracks/mid-junior/README.md) |
| **Senior Full-Stack UI/UX** | Full-stack IC. Production-shape concerns: auth, multi-tenancy, observability, error handling. | [docs/tracks/senior/README.md](docs/tracks/senior/README.md) |
| **Engineering Manager** | Deeply product-minded, with strong enough architectural judgment to make pragmatic technical decisions without over-optimizing for infrastructure complexity. They should bring lived experience shipping customer-facing products quickly, working closely with product to iterate fast and get the right features into users’ hands. | [docs/tracks/em/README.md](docs/tracks/em/README.md) |

The rest of this README covers what's shared across tracks: how to run
the mock, how to switch to the real API, ground rules, submission.

## What's in the box

- A FastAPI mock backend that mirrors the Parasail API shape, with
  realistic latency, streaming, configurable error injection, and the
  same `psk-<accesskey>-<secretkey>` auth shape the real API uses.
- An OpenAPI 3 spec ([backend/openapi.yaml](backend/openapi.yaml)) and
  a Postman collection
  ([backend/postman-collection.json](backend/postman-collection.json)).
- Example request payloads in [examples/payloads/](examples/payloads/).
- An [API cookbook](docs/api-cookbook.md) with the common flows in
  curl + JS, including the SSE streaming pattern.
- Three path briefs in [docs/paths/](docs/paths/) that the Mid/Junior
  and Senior tracks reference. Each path is labeled drop-in compatible vs
  mock-only future-state so you know what works against production.
- A [mock-to-real divergence map](docs/switching-mock-to-real.md).
- A `docker compose up` for one-command spin-up.

## How to run

```bash
cp .env.example .env
docker compose up
```

The mock backend is at `http://localhost:3001`. Try it:

```bash
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer psk-mock-mockkey"
```

Interactive docs (Swagger UI): `http://localhost:3001/docs` (no auth
required).

If you'd rather run the mock without Docker:

```bash
cd backend/mock-server
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```

## Switching to the real Parasail API

Change two env vars in your `.env`:

```bash
PARASAIL_BASE_URL=https://api.parasail.io/api/v1/openai
PARASAIL_API_KEY=psk-<accesskey>-<secretkey>
```

The same client code that works against the mock works against
production for the inference endpoints (`/v1/models`,
`/v1/chat/completions`). For the future-state endpoints
(api-keys, usage, deployments) the mock is the only place they exist
today. See [docs/switching-mock-to-real.md](docs/switching-mock-to-real.md)
for the full divergence map.

If we've issued you a real Parasail key it has a small spend cap, tight
rate limits, and expires after the submission deadline.

## Ground rules (all tracks)

- **Any stack.** Frontend, backend, DB, framework — your call. Pick
  what lets you move. For context, our production work is mostly
  Spring Boot, React, and Postgres; using those is welcome but not
  required.
- **Any tools.** Claude Code, Cursor, Copilot, vim, whatever. We do
  care that you can talk through what you built and why — and where AI
  helped vs got in the way.
- **Don't clone our existing portal.** We've all seen it; we want
  yours.
- **Time is bounded by judgment, not a stopwatch.** Log your total in
  your `NOTES.md`. As a rough guide, Mid/Junior and Senior candidates
  should aim for a focused take-home, not a weekend project; EM
  candidates should keep the required recommendations work to about a
  half day. We're not measuring against the highest spender; we're
  calibrating the rest of your work against effort.
- **Polish over scope.** A small finished thing beats a sprawling
  half-built thing every time.
- **Make it easy to review.** A preview URL is useful, but not worth
  losing hours to hosting/configuration. Clear local run instructions
  and a working repo matter more than deployment heroics.

## Submitting

1. Push to a GitHub repo (public is fine; private is fine if you invite
   the reviewer).
2. Include one-command local run instructions. `docker compose up`,
   `npm run dev`, or equivalent is fine.
3. Preview URL strongly encouraged for Mid/Junior + Senior tracks —
   Vercel, Render, Fly, Railway, your own VPS, your call — but not a
   hard gate. If deployment eats time, note what happened and give us
   the cleanest local path instead. The EM track has its own deliverables
   list.
4. Fill out the `NOTES.template.md` in your track folder and rename to
   `NOTES.md`.
5. (Optional) Record a 3–5 min Loom walking through what you built.

Send the repo URL, preview URL if you have one, and any local run notes
to your recruiter contact.

## What happens next

Async review (15–20 min on the repo, preview/local app, and your notes),
then a 30–60 min live session. You drive — walk us through what you
built, what you cut, what you'd do next. We'll probe tradeoffs.

Good luck. Have fun with it.
