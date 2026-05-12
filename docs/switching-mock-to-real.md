# Switching from the mock to the real Parasail API

The mock is faithful enough to the real API that you can build the entire
take-home against it. This page is the divergence map you need if you want
to point at production with a real key.

## How to switch

```bash
# Mock (default)
PARASAIL_BASE_URL=http://localhost:3001
PARASAIL_API_KEY=psk-mock-mockkey

# Real
PARASAIL_BASE_URL=https://api.parasail.io/api/v1/openai
PARASAIL_API_KEY=psk-<accesskey>-<secretkey>
```

The path suffix you call (`/v1/models`, `/v1/chat/completions`) doesn't
change — the difference is absorbed into `PARASAIL_BASE_URL`.

## Auth

Both the mock and the real API expect the same shape:

```
Authorization: Bearer psk-<accesskey>-<secretkey>
```

- **Mock**: validates *format only* — any `psk-X-Y` (alphanumerics + `_`)
  passes. Returns `401` with `error.type=unauthorized` for missing or
  malformed tokens.
- **Real**: validates the same format, then looks up `<accesskey>` in the
  account table and BCrypt-checks the secret. Returns `401` (with a
  short text body) for any failure. Rejects the literal placeholder
  `<PARASAIL_API_KEY>`.

Designing your error handler around `error.type` + the 401 status code
gets you compatibility across both.

## Endpoint compatibility

### Drop-in compatible — code works against both

| Endpoint | Notes |
|---|---|
| `GET /v1/models` | Identical shape: `{object: "list", data: [...]}` |
| `POST /v1/chat/completions` | OpenAI-compatible; both `stream: true` and non-streaming work the same way against both |

If your take-home uses **only** these endpoints (Path 1 — Playground), a
real key flips you straight to production with no code changes.

### Mock-only — future-state product surfaces

These endpoints exist *only* in the mock. They're surfaces the Speedboat
team plans to ship; the take-home includes them so candidates can
prototype against them. **Don't expect production to respond to these.**

| Endpoint | Used by |
|---|---|
| `GET /v1/api-keys`, `POST /v1/api-keys`, `PATCH /v1/api-keys/:id`, `DELETE /v1/api-keys/:id` | Path 2 |
| `GET /v1/usage` | Path 2 |
| `POST /v1/spend-limits` | Path 2 |
| `GET /v1/gpu-types` | Path 3 |
| `GET /v1/deployments`, `POST /v1/deployments`, `GET /v1/deployments/:id`, `DELETE /v1/deployments/:id` | Path 3 |
| `GET /v1/deployments/:id/logs` (SSE) | Path 3 |

If your take-home builds against any of these, your code won't work
against the real API today. That's expected — the take-home is partly
about prototyping the API shape we'd want to ship. In your `NOTES.md`,
flag any gaps in the mock's shape that you'd push back on as a frontend
partner.

### Real has, mock doesn't (informational)

The real API exposes additional surfaces the mock doesn't bother with —
none of the take-home paths use them, but they're worth knowing about
if you're poking at the real API from curiosity:

- Inference: `POST /v1/completions` (legacy), `POST /v1/responses`,
  `POST /v1/embeddings`, `POST /v1/score`, `POST /v1/rerank`,
  `POST /pooling`
- Audio: `POST /v1/audio/transcriptions`, `POST /v1/audio/speech`
- Batch: `POST /v1/batches`, list / retrieve / cancel / retry under
  `/v1/batches`
- Files: `POST /v1/files`, list / retrieve / delete / `GET
  /v1/files/:id/content`
- Voice: `GET /v1/voice`, `GET /v1/voice/:id`, `POST /v1/voice`,
  `POST /v1/voice/:id/resemble-embedding`
- Billing: `GET /api/v1/billing/invoices` (note this lives under
  `/api/v1/billing`, not `/api/v1/openai`, so calls to it require a
  different `PARASAIL_BASE_URL`)

## What to do if you find a divergence we didn't list

Note it in `NOTES.md`. We'll happily count "noticed and noted a
divergence" as a green flag.

## Limited keys for the take-home

If we sent you a real Parasail key, it's:

- **Capped on spend** at a small dollar amount.
- **Rate-limited** more tightly than production keys.
- **Time-bound** — it expires after the submission deadline.

You don't need to use it. The mock covers everything Path 1 needs, and
Paths 2 + 3 are mock-only by design.
