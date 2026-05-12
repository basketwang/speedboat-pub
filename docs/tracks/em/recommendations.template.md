# Recommendations

> Rename to `recommendations.md` before submitting. Required for the
> EM track.

Aim for ~1,500–2,500 words. Diagrams welcome. Don't pad.

## Headline

In one paragraph: if you got the seat tomorrow, what's the headline
move you'd make in the first 90 days, and why?

## Top 3 risks at 10× platform load

For each: what breaks, what evidence in [ARCHITECTURE.md](ARCHITECTURE.md)
points to it, and what you'd do.

### 1.

### 2.

### 3.

## Top 3 risks at 100× platform load

### 1.

### 2.

### 3.

## Customer mix

[ARCHITECTURE.md](ARCHITECTURE.md) calls out that the customer is
sometimes a human, sometimes a service, and sometimes an agent. Where
in your recommendations does that distinction *change the answer*? Two
or three concrete examples — places where you'd design for non-humans
differently than you'd design for humans.

-
-
-

## Build vs buy

For each row, fill in the column that applies and *why*. Reasoning
beats conclusions. We want to understand how you weigh switching
cost vs maintenance burden vs vendor risk.

| Capability | Build | Buy | Reason |
|---|---|---|---|
| Identity / SSO / SAML / SCIM (humans) |  |  |  |
| Workload / service / agent identity (non-humans) |  |  |  |
| Usage-based billing |  |  |  |
| Customer-facing observability (request logs, usage charts) |  |  |  |
| Internal observability (logs, metrics, traces, alerting) |  |  |  |
| Audit logging (customer-facing) |  |  |  |
| Secrets management |  |  |  |
| API rate-limiting / spend-cap enforcement |  |  |  |
| Fraud / abuse detection |  |  |  |
| Status page |  |  |  |
| Email / transactional comms |  |  |  |

## Phased rollout

What you'd ship in 30 days, 90 days, and 180 days. Be opinionated
about what gets *deferred* — that's where the value is.

### First 30 days

- Listen tour: who:
- Quick win you'd ship:
- Thing you'd kill or freeze:

### 30–90 days

-
-

### 90–180 days

-
-

### Explicitly deferred

What you'd say "not yet" to and why.

-

## Lived-experience appendix

For each major recommendation above, mark **Lived** or **Proposed**.

- **Lived**: I've personally shipped a comparable thing. Add 1–2
  sentences on the context (company, scale, what the work was, what
  bit you).
- **Proposed**: I haven't shipped this; I'm proposing it based on
  reading / second-hand experience. Add 1 sentence on how I'd
  de-risk in the first month.

We'll respect both. We won't respect blurred ones.

| Recommendation | Lived / Proposed | Context (if Lived) or de-risk plan (if Proposed) |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

## What I'd want before committing to any of this

If you got hired and we said "go," what would you ask for *first*
before changing anything?

-
-
-

## Open questions you'd ask the team

The questions you'd want answered before your first all-hands:

-
-
-
