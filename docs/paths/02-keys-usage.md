# Path 2 — API Key & Usage Console

A dashboard for managing API keys and watching real-time usage. The page a
developer opens at 2am when their app is suddenly racking up spend and they
need to know which key is responsible.

> **API status: future-state.** The endpoints this path uses (api-keys
> CRUD, usage, spend-limits) do **not** exist in the real Parasail API
> today — they're on the team's roadmap. The mock implements them so
> you can prototype the dashboard the team plans to ship. This is also
> a real signal: tell us in your notes what you'd want the API to look
> like, what's missing from the mock's shape, and where you'd push back
> on it as a frontend partner.

## Why this exists

Every Parasail customer eventually needs three things at once: a way to
issue and rotate keys, a clear picture of what those keys are spending, and
a way to put a ceiling on spend before it ruins their week. Today these
live in different places. The console is one screen for all three.

## What you're building

A dashboard with two halves a developer can flip between (or see together,
your call):

**Keys**
- List existing keys with their masked values, scopes, current spend, last
  used time, and a clear revoked-vs-active distinction.
- Create a new key: give it a name, pick scopes, optionally set a spend
  limit. Show the full secret **once** (because that's what the API does).
- Edit a key's name, scopes, or limit.
- Revoke a key with a confirmation that's appropriately sticky for an
  irreversible action.

**Usage**
- A chart of requests / tokens / spend over a chosen time range, with day
  and hour granularity.
- Filter by key and/or model.
- Totals + trend vs prior period.
- A table of top consumers (by key, by model) — the kind of "who broke
  it?" view that earns its keep at 2am.
- Spend limits: set a monthly cap account-wide or per key, with alert
  thresholds (50/80/100%).

## Example user stories

- *"As a security-conscious dev, I rotate a leaked key in under 30 seconds
  — including copying the new one safely and revoking the old one."*
- *"As an engineering lead, I open the dashboard on a Monday and within
  10 seconds I know whether last week's spend was normal."*
- *"As a dev about to ship a new feature, I create a scoped key, cap it at
  $25/mo, and copy it once — confident I'll see an alert before it
  blows up."*

## Endpoints you'll use

| Method | Path | What for |
|---|---|---|
| GET | `/v1/api-keys` | List keys |
| POST | `/v1/api-keys` | Create a key (returns full secret once) |
| PATCH | `/v1/api-keys/:id` | Rename, change scopes, change limit |
| DELETE | `/v1/api-keys/:id` | Revoke (soft-delete) |
| GET | `/v1/usage` | Time-series usage — `granularity=day\|hour`, optional `api_key_id` and `model` filters |
| POST | `/v1/spend-limits` | Set monthly cap + alert thresholds |

A full payload example for key creation is at
[`examples/payloads/create-api-key.json`](../../examples/payloads/create-api-key.json).

## Example requests

```bash
# Create a scoped key with a cap.
curl -X POST http://localhost:3001/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "name": "ship-it-friday",
    "scopes": ["inference:read", "inference:write"],
    "spend_limit_usd": 25
  }'

# Hourly usage for a single key, filtered to one model, last 24h.
curl "http://localhost:3001/v1/usage?\
start=2026-05-04T00:00:00Z&\
end=2026-05-05T00:00:00Z&\
granularity=hour&\
api_key_id=key_01H8ZRTNK4F1XG7PMVB6JQWE2C&\
model=parasail-llama-3.1-70b-instruct" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"
```

## What we're testing

- **Info-dense dashboard design.** Hierarchy on a screen that wants to
  show ten things at once without feeling crowded.
- **Forms.** The create-key flow is a real test — scopes, limits, the
  one-time-secret moment, all without giving the user a chance to lose
  the secret.
- **Tables and charts.** Sortable, filterable, with thoughtful defaults.
- **Settings UX.** Limits and alert thresholds need to feel safe to set.
- **Security thinking.** Key masking, revoke-vs-edit affordances, copy-to-
  clipboard with confirmation, irreversible-action confirmations.

## Stretch ideas (only if you have time)

- Per-key usage breakdown drilldown.
- Anomaly callouts (e.g., "spend up 4× vs last week" badge on a key).
- Downloadable CSV of the current view.
- Webhook config for spend alerts.
- Audit log of key create / revoke / edit events.

## Notes on the mock

- The mock returns the full secret in the `secret` field on `POST
  /v1/api-keys` — and only there. Subsequent fetches return only `prefix +
  last_four`. Treat this as a real product behavior to design around, not
  a mock quirk.
- Revocation is a soft delete (`revoked_at` timestamp). Pass
  `?include_revoked=false` to hide them.
- `?_simulate=429` on any endpoint forces a rate-limit response — use to
  build error and retry UI.
- The usage endpoint synthesizes plausible series from a small set of
  seeded daily aggregates, including hourly diurnal shape. Charts will
  look real.
