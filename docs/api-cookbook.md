# API cookbook

The flows you'll need most. All examples assume:

```bash
export PARASAIL_BASE_URL=http://localhost:3001
export PARASAIL_API_KEY=psk-mock-mockkey
```

## Auth & base URL

Every request needs `Authorization: Bearer psk-<accesskey>-<secretkey>`.
The mock validates the *format* (three dash-separated parts, `psk-`
prefix); the real API validates the same shape against its database.
The default mock key `psk-mock-mockkey` passes the format check.

The mock and the real API share endpoint *suffixes* but the real API
serves them under `/api/v1/openai`. Absorbing that segment into
`PARASAIL_BASE_URL` means the same client code works against both:

```bash
# Mock
PARASAIL_BASE_URL=http://localhost:3001
# Real
PARASAIL_BASE_URL=https://api.parasail.io/api/v1/openai
```

In both cases your code calls `${PARASAIL_BASE_URL}/v1/models`.

**Future-state endpoints** (api-keys, usage, spend-limits, deployments,
gpu-types) currently only exist in the mock. See
[switching-mock-to-real.md](./switching-mock-to-real.md) for the full
divergence map.

## List models *(real-API compatible)*

```bash
curl "$PARASAIL_BASE_URL/v1/models" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"
```

```js
const res = await fetch(`${BASE}/v1/models`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
const { data: models } = await res.json();
```

## Streaming chat completion *(real-API compatible)*

```bash
curl -N "$PARASAIL_BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "model": "parasail-llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

```js
// Browser — fetch + ReadableStream. No SDK needed.
const res = await fetch(`${BASE}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${KEY}`,
  },
  body: JSON.stringify({
    model: "parasail-llama-3.1-70b-instruct",
    messages: [{ role: "user", content: "Hello!" }],
    stream: true,
  }),
  signal: abortController.signal, // <-- so you can cancel mid-stream
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });

  // SSE: events are separated by blank lines; each event has `data: <json>`.
  const events = buf.split("\n\n");
  buf = events.pop(); // last partial event stays in the buffer

  for (const evt of events) {
    const line = evt.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const payload = line.slice(6);
    if (payload === "[DONE]") return;
    const chunk = JSON.parse(payload);
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) appendToUI(delta);
  }
}
```

Cancel a stream with `abortController.abort()` — the mock terminates
cleanly.

## Create + use an API key *(mock-only future-state)*

```bash
# Create. The full secret is in `.secret` — only returned this one time.
# Issued in `psk-<accesskey>-<secretkey>` format, the same shape the mock
# (and real) auth middleware validates.
curl -X POST "$PARASAIL_BASE_URL/v1/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "name": "ship-it-friday",
    "scopes": ["inference:read", "inference:write"],
    "spend_limit_usd": 25
  }'

# List (revoked keys included by default).
curl "$PARASAIL_BASE_URL/v1/api-keys?include_revoked=false" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"

# Revoke (soft delete).
curl -X DELETE "$PARASAIL_BASE_URL/v1/api-keys/key_01H8ZQYG3M3K2VR9WQ4N5J7P0E" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"
```

## Usage report *(mock-only future-state)*

```bash
# Last 7 days, daily granularity.
curl "$PARASAIL_BASE_URL/v1/usage?\
start=2026-04-29T00:00:00Z&\
end=2026-05-06T00:00:00Z&\
granularity=day" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"

# Last 24h, hourly, scoped to one key + model.
curl "$PARASAIL_BASE_URL/v1/usage?\
start=2026-05-04T00:00:00Z&\
end=2026-05-05T00:00:00Z&\
granularity=hour&\
api_key_id=key_01H8ZRTNK4F1XG7PMVB6JQWE2C&\
model=parasail-llama-3.1-70b-instruct" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"
```

The response always includes a `totals` object — handy for headline cards.

## Spend limits *(mock-only future-state)*

```bash
# Account-wide cap.
curl -X POST "$PARASAIL_BASE_URL/v1/spend-limits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{"scope": "account", "monthly_limit_usd": 1000, "alert_thresholds_pct": [50, 80, 100]}'

# Per-key cap (also updates spend_limit_usd on the key).
curl -X POST "$PARASAIL_BASE_URL/v1/spend-limits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "scope": "api_key",
    "api_key_id": "key_01H8ZRTNK4F1XG7PMVB6JQWE2C",
    "monthly_limit_usd": 100
  }'
```

## Deploy a model *(mock-only future-state)*

```bash
# 1. Pick a GPU.
curl "$PARASAIL_BASE_URL/v1/gpu-types" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"

# 2. Create the deployment.
curl -X POST "$PARASAIL_BASE_URL/v1/deployments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "name": "llama-coder-dev",
    "model_source": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "gpu_type": "a100",
    "replicas": 1,
    "autoscaling": {"min": 1, "max": 2, "target_concurrency": 4}
  }'

# 3. Poll status. Each call advances the deployment one step until running.
curl "$PARASAIL_BASE_URL/v1/deployments/dep_..." \
  -H "Authorization: Bearer $PARASAIL_API_KEY"

# 4. Tail logs (SSE).
curl -N "$PARASAIL_BASE_URL/v1/deployments/dep_.../logs" \
  -H "Authorization: Bearer $PARASAIL_API_KEY"
```

## Error injection

Useful for building loading + error states without mocking your own
network failures. **Bypasses auth** — you don't need a valid token to
trigger a simulated error, so the error UI can be exercised in
isolation.

```bash
# Force a 429 on any endpoint via query string ...
curl "$PARASAIL_BASE_URL/v1/models?_simulate=429"

# ... or via header.
curl "$PARASAIL_BASE_URL/v1/models" -H "X-Simulate-Status: 503"
```

Error body shape:

```json
{
  "error": {
    "type": "simulated_error",
    "code": 429,
    "message": "Simulated 429 response (injected by client)."
  }
}
```

## What 401 looks like

If you forget the header or send a malformed token, the mock returns:

```json
{
  "error": {
    "type": "unauthorized",
    "code": 401,
    "message": "Missing or malformed Authorization header. Expected 'Authorization: Bearer psk-<accesskey>-<secretkey>'."
  }
}
```

The real API returns 401 on the same conditions but its message body
may differ — design your error handling around `error.type` + status
code, not the exact message.
