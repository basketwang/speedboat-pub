# Path 1 — Model Playground

A web playground for chatting with deployed Parasail models. Like the
OpenAI playground, but ours.

> **API status:** the two endpoints this path uses (`GET /v1/models` and
> `POST /v1/chat/completions`) exist in the real Parasail API today.
> Code you write here keeps working when you swap `PARASAIL_BASE_URL`
> from the mock to production.

## Why this exists

Developers evaluating Parasail want to test models the moment they land on
the docs. The faster they can get a real, useful response into their chat
window, the higher the chance they'll integrate. The playground is a sales
tool dressed up as a dev tool — and it has to feel as good as the best ones
they've already used.

## What you're building

A single-page web app that lets a developer:

- Pick from the models returned by `GET /v1/models`.
- Type into a chat-style composer with a system prompt that's editable but
  collapsible.
- Stream the model response token-by-token.
- Adjust sampling parameters (temperature, top-p, max tokens, stop, seed)
  with immediate effect on the next message.
- Stop a generation in flight.
- Keep a session of recent chats locally (browser persistence is fine).
- Share a chat (or starting state) by URL — params and prompt encoded in
  the link, so a colleague can open it and continue.

## Example user stories

- *"As a developer evaluating Parasail, I open the playground, pick a model,
  paste my real prompt, and watch tokens stream — within 60 seconds of
  landing on the page."*
- *"I tweak the system prompt, hit run again, and see the new response
  side-by-side with the old one so I can tell whether it actually
  helped."*
- *"I find a prompt that works, copy a share-link, drop it in Slack, and a
  teammate opens it with the same model + params + prompt pre-filled."*

## Endpoints you'll use

| Method | Path | What for |
|---|---|---|
| GET | `/v1/models` | Populate the model picker |
| POST | `/v1/chat/completions` (with `stream: true`) | Run the chat |

The streaming endpoint follows OpenAI's SSE format
(`data: <json>\n\n`, terminated with `data: [DONE]`). See
[../api-cookbook.md](../api-cookbook.md) for a working JS snippet.

## Example request

```bash
curl -N http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARASAIL_API_KEY" \
  -d '{
    "model": "parasail-llama-3.1-70b-instruct",
    "messages": [
      {"role": "system", "content": "You are a concise senior engineer."},
      {"role": "user", "content": "Explain prompt caching in 3 bullets."}
    ],
    "temperature": 0.6,
    "stream": true
  }'
```

A full payload example is at
[`examples/payloads/chat-completion.json`](../../examples/payloads/chat-completion.json).

## What we're testing

- **Real-time streaming UX.** First-token latency, smooth token rendering,
  cancel-mid-stream behavior.
- **Dev-tool feel.** Keyboard shortcuts, copyable code blocks, sensible
  defaults, predictable focus management.
- **Micro-interactions.** Hover/focus states, loading affordances, the
  small touches that make a UI feel finished.
- **Latency awareness.** The mock injects 50–300ms of latency on every
  request — your UI shouldn't feel laggy because of it.

## Stretch ideas (only if you have time)

- Side-by-side comparison: send the same prompt to two models and render
  both streams in a split view.
- Prompt versioning — when you edit the system prompt, keep the previous
  version reachable so you can A/B between them.
- Token cost estimator: use the per-model pricing in `GET /v1/models` to
  show running cost as the response streams.
- Prompt history with search.

## Notes on the mock

- `?_simulate=429` (or `500`) on `/v1/chat/completions` will give you an
  error to test against without abusing the mock.
- The mock streams real word-ish chunks at a realistic cadence — not a
  whole response at once.
- Response content is canned but deterministic per prompt, so the same
  user message always returns the same reply. Useful for screenshots.
