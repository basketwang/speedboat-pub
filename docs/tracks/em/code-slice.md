# Optional code slice

> Optional deliverable for the EM track. Strong positive signal if you
> choose to do it, but not required for a complete submission.

Pick **one** slice below. Ship it against the mock backend in this repo.
Target: a narrow, working implementation. The point isn't a finished
feature — it's to confirm you can drop into a real codebase and produce
something coherent that runs.

You're scored on:

- Did it run?
- Did your choice match what your recommendations doc says you'd
  prioritize? (We notice the consistency.)
- Did you make tradeoffs that someone with platform experience would
  recognize?

You're **not** scored on:

- Polished UI (this isn't an IC track).
- A complete feature (a working narrow slice beats a half-built
  broad one).

## The slices

### A — Replace the mock's static auth filter with a real OIDC flow

[`backend/mock-server/auth.py`](../../../backend/mock-server/auth.py)
currently validates the format of `psk-<accesskey>-<secretkey>` and
nothing else. Replace it (or layer onto it) so the mock can
optionally accept tokens issued by an OIDC provider — WorkOS-mock,
Auth0 free tier, Authentik, or hand-rolled JWT signing locally.

Show:

- The token validation flow: who signs, who verifies, where keys
  rotate.
- A path the existing `psk-...-...` keys take through the new
  filter (so production keys still work).
- A 401 envelope that's distinguishable between "no token,"
  "wrong format," and "expired / invalid signature" so a frontend
  team can build a useful retry/login flow against it.

Why this slice exists: identity is often the thing your recommendations
doc will put near the top. Implementing a piece of it shows you've
thought through the migration.

### B — A metering + rate-limit middleware backed by a real store

The mock today simulates rate limits via the `?_simulate=429` knob.
That's a *test* affordance, not a *product* affordance. Replace or
augment it with a middleware that:

- Tracks per-token request counts in Redis or Postgres (your call —
  defend the choice).
- Enforces a configurable per-minute rate limit and a per-token
  monthly spend cap.
- Emits a `429` with a real `Retry-After` header when limits are hit.
- Surfaces the current usage on a `GET /v1/me/usage` (or similar)
  so the frontend can render headroom.

Why this slice exists: usage and spend-control systems often fail at
the boundary between metering truth and real-time enforcement. Showing
a path through that tension is useful signal.

### C — An audit log fed by the mock's mutating endpoints

There is no audit log in the platform today. Add one:

- A new `audits` table (or in-memory persisted log; declare which
  and why).
- Every mutating endpoint in the mock (`POST /v1/api-keys`, key
  revocation, deployment create/delete, spend-limit set) writes a
  row with `actor`, `action`, `resource_id`, `before`, `after`,
  `ip`, `user_agent`, `ts`.
- A `GET /v1/audits` endpoint that lists, filterable by `actor`
  and `action`. Mock-only is fine; this surface doesn't exist in
  production yet.
- A retention story you'd write down (even if you don't enforce
  it in code).

Why this slice exists: customers asking for enterprise identity often
ask for auditability next. This is a small way to show how you'd start.

## What to submit if you choose a code slice

In your repo, alongside your recommendations doc:

- A `code-slice/` directory (or a feature branch — your call) with
  the implementation.
- A `code-slice/README.md` explaining:
  - Which slice you chose and why (1 paragraph).
  - How to run it locally (one command if you can).
  - Tradeoffs you made (~3 bullets).
  - What's NOT done that you'd do next.
- The mock should still pass its existing smoke tests after your
  changes — you can extend, you shouldn't break.

## A note on AI

Use it. The slice is small enough that AI can write a lot of it.
We'll be looking at the *seams* — where you accepted, where you
edited, where you replaced AI's first draft. In the live session
we'll ask you to walk one specific function from the slice. Pick
ahead of time which one.
