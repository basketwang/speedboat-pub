# Mid/Junior Full-Stack UI/UX track

Build a piece of the Speedboat developer experience that feels like
something we'd ship. We care most about your design *thinking* and the
craft of the result — your code can lean on the mock backend.

## What we're evaluating

In rough weight order:

1. **Visual + interaction craft** — hierarchy, typography, spacing,
   micro-interactions. The small stuff that makes a UI feel intentional.
2. **Design thinking** — alternatives you considered, what you cut and
   why, where you chose against AI's first draft.
3. **UX defaults** — empty / loading / error states, opinionated
   defaults, friction removed.
4. **Working code** — the build runs, the API calls work, and the app
   is easy for a reviewer to open locally or via preview URL.

We are not weighting backend depth here. The mock backend handles
everything.

## Pick your path

Choose **one**:

| Path | Brief |
|---|---|
| 1 — Model Playground | [../../paths/01-playground.md](../../paths/01-playground.md) |
| 2 — API Key & Usage Console | [../../paths/02-keys-usage.md](../../paths/02-keys-usage.md) |

Path 3 (Deployment Wizard) is **not** offered for this track — its
async/SSE bar fits the Senior brief.

## What you must submit

1. **Source repo** — public, or private with reviewer invite.
2. **Local run instructions** — one command if you can. If you provide
   a Docker Compose setup, even better.
3. **Preview URL, strongly encouraged** — Vercel / Render / Fly / your
   call. Don't burn hours on hosting if the product work is done; tell
   us what happened and give us the cleanest local path instead.
4. **`design-rationale.md`** — fill out
   [design-rationale.template.md](design-rationale.template.md). This
   is non-negotiable for this track. Screenshots / sketches of
   alternatives encouraged.
5. **`NOTES.md`** — fill out
   [NOTES.template.md](NOTES.template.md) and rename.
6. *(Optional)* 3–5 min Loom walking us through your decisions.

## Brand input

We've given you a stylized starter design system at [BRAND.md](BRAND.md):
palette, type, voice, and a few component primitives. The point is to
design with a real constraint, not from a blank page.

You can extend it, simplify it, or push back on it. If you override a
brand decision, make the reasoning visible in your design rationale.
We're assessing judgment, not obedience.

## How we read your work

A reviewer will:

1. Open your preview URL if available, or run the app locally and try
   the golden path.
2. Click through your `NOTES.md` and `design-rationale.md`.
3. Skim the source for organization (we won't pour over every file).
4. Book a live session — you walk us through it.

The bar at the live session is *can you defend the decisions*. It's
fine to say "I tried X, didn't work, here's what I chose instead" or
"I'd do Y differently with more time." It's not fine if the visible
polish is high but you can't tell us why anything is the way it is.

## A note on AI

Use it. Don't pretend you didn't. Note in `NOTES.md` where it helped,
where it produced something generic that you replaced, and where you
chose against it. AI-generated polish without a design rationale is a
yellow flag — design thinking is the part we can't automate.
