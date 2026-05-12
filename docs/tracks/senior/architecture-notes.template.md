# Architecture notes

> Rename to `architecture-notes.md` before submitting. Required for the
> Senior track.

The point of this doc isn't to write a textbook system-design
deliverable. It's to make your reasoning visible so a reviewer can
read it before the live session and spend the call pushing on
tradeoffs instead of asking what you built.

Aim for ~1,000 words. A diagram or two helps. Bullet points are fine.

## At a glance

- **Path(s) shipped:**
- **Stack (frontend, backend, DB, hosting):**
- **What's available via preview URL vs local-only:**
- **Estimated production-readiness, 1–10:** _____
  *(Be honest. A 4 with reasons beats an 8 with vibes.)*

## Architecture diagram

(Sketch, ASCII, exported Excalidraw — anything readable.)

```
[ user ] → [ frontend ] → [ ??? ] → [ mock ]
```

## Auth

What you chose, what you considered, why.

- **Identity:**
- **Token storage / refresh:**
- **What happens on 401:**
- **What I'd do differently in production:**

## Data model

If you persist anything, show the shape. Tenant-awareness explicitly.

- **Tenancy model (org → user → resource):**
- **What lives in the browser vs the server:**
- **Migrations / schema-evolution story:**

## State management

- **Client-side state choice (and why not the alternative):**
- **Server-side caching or invalidation, if any:**
- **What I'd change at 10×:**

## Error & resilience

- **Where the retry boundary lives:**
- **What happens when a stream drops mid-request:**
- **What happens when the mock returns 429 (you can simulate this):**
- **What I'd add for production that I didn't add here:**

## Observability

What signals you emit, where, and why those.

- **Logs:**
- **Metrics:**
- **Traces (if any):**
- **What I'd alert on first:**

## Tradeoffs I'd defend

The 3–4 places you made a non-obvious call. State the call, the
alternative, and the reason.

1.
2.
3.

## What I'd build next

If this were the start of a quarter rather than a take-home:

-
-
-
