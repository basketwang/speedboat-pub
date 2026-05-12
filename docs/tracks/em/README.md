# Engineering Manager track

This track is different from the IC tracks. It's a homework + interview
prompt, not a code sprint. The point is to see how you reason about
**owning the Speedboat platform experience at scale**, and to separate
recommendations you can generate from recommendations you've actually
shipped.

## What the role actually is

You'd lead the **Speedboat product-experience team** — the people who
own the customer-facing surface (web portal, billing, auth, API key
management, developer experience). You're a software engineer first
and a thought leader second. Closer to a Solutions Architect than a
people manager who has stopped writing code.

You don't own the inference plane or core backend infra. You **do**
own every surface a customer touches — and our "customer" is a mix
of humans (logging into the portal), services (apps built on
Parasail), and agents (autonomous LLM workflows hitting our API).
You're the single throat to choke when that platform experience drifts
for any of them. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the texture on how that mix
shapes identity, rate-limiting, and audit decisions.

The bar is *withstanding very large scale* — the conversation that
shaped this role kept landing on:

- scalability and architecture choices
- security exposure
- resilience under attack
- operational maturity at scale
- pragmatic build-vs-buy judgment — when do we stop building, when do
  we externalize?

You should care deeply about UX, even though you may not personally
produce visual design.

## What we're testing

1. Can you design for **scale, security, and future-proofing**?
2. Can you identify what Parasail **should** and **should not** build?
3. Can you separate recommendation *quality* from *lived experience*?
4. Can you own the **holistic platform experience** rather than
   isolated frontend execution?

## The homework

We're sending this to you 48–72 hours before the live interview. It
shouldn't take more than a half day if you focus on the required
recommendations doc. We'd rather you ship a sharp, opinionated
submission than a sprawling exhaustive one.

### Pre-read

Read [ARCHITECTURE.md](ARCHITECTURE.md). It's a sanitized case study of
the kind of platform Speedboat owns. There are intentional gaps and
tensions in it. Don't try to fix everything.

### Deliverable 1 — Recommendations doc

Fill out
[recommendations.template.md](recommendations.template.md). Required.

It's structured to push you on three things:

- **Top 3 risks at 10× platform load. Top 3 at 100×.**
- **Build-vs-buy calls** across auth, billing, observability, identity
  / audit, secrets, fraud. Each call needs a *reason* — pricing,
  maintenance burden, switching cost, integration surface, your past
  experience with the vendor.
- **Lived-experience appendix.** For every major recommendation,
  mark it as "I have personally shipped this before at <context>" or
  "I am proposing this fresh based on reading." We'll respect both.
  We won't respect blurring the line.

### Deliverable 2 — Code slice *(optional, strong positive signal)*

If you want to show that you still enjoy dropping into code, pick one
slice from [code-slice.md](code-slice.md) and ship it against the mock
backend. This is optional. The point isn't a finished feature — it's to
see that you can produce something coherent and connect it to your
recommendations.

This is the part that distinguishes "EM who codes" from "EM who
delegates code." You don't need to polish pixels or build a broad
feature. A working narrow slice is enough.

### Deliverable 3 — `NOTES.md`

Fill out [NOTES.template.md](NOTES.template.md) and rename. Where you
did the work, where you delegated to AI, what you'd do in your first
30 days if you got the role.

## What you do **not** need to ship

- A polished UI. (You don't have to deploy anything.)
- A fix for everything wrong with the architecture.
- A code slice, unless you choose to use it as extra signal.
- The "right" build-vs-buy answer. We want your reasoning more than
  your conclusion.

## Live interview

A 60 min session, Cyril-led. We'll spend it on:

- 10 min — you walk us through your top recommendation and the code
  slice if you shipped one.
- 30 min — we probe specific recommendations against your
  lived-experience tags. The question we'll keep asking is "when have
  you personally done this, and what bit you when you did?" "I
  haven't" is fine — followed by "here's how I'd learn it fast" is
  better.
- 20 min — your questions for us, plus a discussion of how you'd run
  the first 30 days.

We're not trying to trap you. We're trying to figure out which
recommendations come from reading the room (good) and which come from
reading a blog post (also fine, just label it that way).

## A note on AI

Use it. The risk we're guarding against is *recommendations Claude
could have generated for anyone*. Show us where your reasoning came
from your reps and where it came from a model. We're optimizing for
the former at this level.
