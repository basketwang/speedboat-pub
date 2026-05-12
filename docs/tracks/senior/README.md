# Senior Full-Stack UI/UX track

Build a piece of the Speedboat developer experience the way you'd ship
it to production. We're looking for someone who can carry a feature
end-to-end — visual design through deploy — and who already has
opinions about auth, multi-tenancy, error boundaries, and observability
because they've seen what breaks at scale.

## What we're evaluating

In rough weight order:

1. **End-to-end craft** — the UI is polished *and* the architecture is
   defensible. Either alone is a Mid/Junior or a Senior-EM signal,
   respectively.
2. **Production-shape thinking** — auth, error boundaries, retry
   policies, multi-tenant data shape, observability hooks, secrets
   handling.
3. **Tradeoff fluency** — you know what you cut and why; you can name
   what you'd do at 10×; you can explain why you didn't reach for the
   shiny option.
4. **UX defaults** — empty / loading / error states, opinionated
   defaults, friction removed.
5. **Visual craft** — should be solid, but the bar is "looks
   intentional" rather than "designed pixel-by-pixel."

## Pick your path (or combine)

| Path | Brief |
|---|---|
| 1 — Model Playground | [../../paths/01-playground.md](../../paths/01-playground.md) |
| 2 — API Key & Usage Console | [../../paths/02-keys-usage.md](../../paths/02-keys-usage.md) |
| 3 — Model Deployment Wizard | [../../paths/03-deployment.md](../../paths/03-deployment.md) |

**Or**: stitch two together if you have a coherent reason. (E.g.,
"Playground + a usage strip showing your current run's cost in real
time" is more interesting than either alone.) Don't try to do all
three — depth beats breadth on this track.

## Production-shape extension

A take-home that just hits the mock isn't telling us much, but a
checklist of production concerns can turn into a time sink. Pick **one**
of the following, in addition to your chosen path(s), and build it
seriously enough to defend. In your architecture notes, name one or two
others you'd tackle next and explain the order.

- **Real auth.** Replace "trust the mock's `psk-` token" with something
  closer to production: WorkOS / Auth0 / Clerk for user identity, or a
  hand-rolled JWT flow with a refresh story. The point isn't which
  vendor — it's whether you can talk through the tradeoff and ship a
  working flow.
- **Multi-tenant data model.** When you persist anything (preferences,
  history, saved prompts, etc.), do it tenant-aware: org → user →
  resource. Show the schema in your architecture notes.
- **Observability hooks.** Pick a tool (or stub) and emit the signals
  you'd actually want at 2am: structured logs with correlation IDs,
  metrics on the request/error/latency ratios, traces if your stack
  supports it. We don't need a real Datadog account.
- **Resilience to mock errors.** Use the `?_simulate=429` /
  `?_simulate=503` knobs to drive a real retry/backoff strategy in
  your client. Show what happens when the third retry fails.
- **Cost or rate-limit awareness.** If your path is doing inference,
  show the running cost or the remaining-budget signal somewhere in
  the UI. (The `pricing` block on each model is in
  `GET /v1/models`.)

## What you must submit

1. **Source repo** — public, or private with reviewer invite.
2. **Local run instructions** — one command if you can. Docker Compose,
   a seeded DB, or a scripted setup is welcome.
3. **Preview URL, strongly encouraged** — Vercel / Render / Fly / your
   call. Useful, not mandatory. If deployment takes time away from the
   senior signal, document the blocker and make the local path clean.
4. **`architecture-notes.md`** — fill out
   [architecture-notes.template.md](architecture-notes.template.md).
   Required.
5. **`NOTES.md`** — fill out
   [NOTES.template.md](NOTES.template.md) and rename.
6. *(Optional)* 3–5 min Loom walking through a tradeoff you'd want a
   reviewer to focus on.

## Backend latitude

The mock is a starting point. You can:

- Use it as-is and put your engineering effort into the frontend +
  thin BFF.
- Wrap it in your own backend (real DB, real auth, your own API) that
  proxies the mock.
- Replace it entirely if you want to host your own inference, your own
  data layer, etc.

Whatever you choose: name the choice in your architecture notes.

## How we read your work

A reviewer will:

1. Open your preview URL if available, or run the app locally, then try
   the golden path **and** the error/edge cases.
2. Read your `architecture-notes.md` first, then `NOTES.md`.
3. Skim the source for organization, error handling, and the auth
   surface specifically.
4. Book a 45–60 min live session focused on tradeoffs.

The live session will probe: "what breaks at 10×?", "why this stack
and not the obvious alternative?", "what would you build if you owned
this for the next quarter?"

## A note on AI

Use it. We don't measure AI use, we measure judgment. Where AI
generated code you accepted as-is, you should still be able to
explain it in the live session.
