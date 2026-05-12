# Speedboat platform case study

> Take-home document. This is a sanitized, stylized case study based on
> the kind of customer-facing platform Speedboat owns. It is not an
> internal architecture map. Some details are intentionally simplified so
> you can focus on judgment, prioritization, and tradeoffs.

You've inherited a product-experience platform for an AI infrastructure
company. Your team owns the surfaces customers touch: web portal, auth,
API key management, usage visibility, billing workflows, docs-adjacent
developer experience, and the API ergonomics around the core inference
platform.

You do not own the inference engine, model serving layer, or GPU fleet.
You depend on those systems, and your customers experience their
failures through your product surface.

## Customer Types

Speedboat has three kinds of customers, and they do not fail the same
way.

- **Humans** log into a portal to create keys, inspect usage, invite
  teammates, view invoices, and manage deployments.
- **Services** use long-running API keys from customer applications,
  CI/CD systems, internal tools, or backend jobs. They drive most
  request volume.
- **Agents** are autonomous workflows that call APIs on behalf of a
  customer. They look like services on the wire, but their failure modes
  are sharper: loops, retries-on-retries, unexpected fanout, delegated
  actions, and spend spikes.

This mix changes the meaning of platform work:

- Login for a human might mean SSO. Identity for a service or agent may
  mean scoped keys, workload identity, short-lived tokens, or delegated
  authorization.
- Rate limits for humans are mostly UX. Rate limits for services and
  agents are reliability, abuse prevention, and spend-control systems.
- Audit for humans asks "who clicked this?" Audit for services and
  agents asks "what parent process, token, task, or delegation chain
  caused this?"
- UX includes the portal, but also error envelopes, retry semantics,
  status pages, rate-limit headers, SDK behavior, and docs.

## Platform Shape

The platform has three broad layers:

```text
[ human browser ]
       |
       | session / SSO
       v
[ web portal ]
       |
       | authenticated product APIs
       v
[ product API / BFF layer ]
       |
       | internal account context
       v
[ machine API / gateway layer ]
       |
       +--> [ relational data store ]
       +--> [ billing / metering provider ]
       +--> [ payment provider ]
       +--> [ inference platform ]
```

The web portal is human-facing. It handles account workflows,
dashboarding, usage views, billing flows, and API key management.

The product API/BFF layer exists so the browser does not handle
machine secrets directly. It translates a human session into account
context and calls downstream product services.

The machine API/gateway layer serves programmatic customers. It accepts
API keys, routes inference-like traffic, enforces account-level access,
and talks to the inference platform.

This split is pragmatic, but it creates product questions an incoming
leader should be able to reason about:

- Should all customer administration be available through both human and
  machine paths?
- Where should key rotation, scoped tokens, and delegated agent actions
  live?
- Which parts of the gateway are product experience, and which belong
  closer to the inference platform?
- Where should audit and authorization events be normalized?

## Decision Areas

### Identity And Authorization

The current product supports human login and machine API keys. Enterprise
customers increasingly ask for SSO, SCIM, richer RBAC, audit logs, and
machine-friendly administration. Agent workflows add pressure for scoped
delegation and short-lived credentials.

Questions to answer:

- What should be bought vs built?
- What identity model works for humans, services, and agents?
- Which actions need scoped authorization before the platform scales?
- How would you migrate without breaking existing API keys?

### Usage, Billing, And Spend Controls

Usage-based billing is core to the business. The platform depends on
metering, invoicing, payment collection, and spend-limit enforcement.
Customers want clearer usage visibility and programmatic access to
account-level usage.

Questions to answer:

- Where should real-time spend awareness live?
- What failure modes matter when usage data is delayed?
- How should customer-facing usage views differ from billing truth?
- Which controls protect customers from runaway services or agents?

### Customer-Facing Observability

Customers need to debug failed requests, streaming interruptions, rate
limits, latency spikes, and deployment behavior. Some of that belongs in
the portal; some belongs in APIs, SDKs, headers, status pages, and docs.

Questions to answer:

- What should a customer be able to inspect without opening a support
  ticket?
- Which signals need to be real-time vs eventually consistent?
- What error and retry contracts should services and agents consume?
- What belongs in product UI vs logs/API responses?

### Internal Operability

The product platform needs logs, metrics, traces, alerting, incident
playbooks, and ownership boundaries that scale with customer traffic.
Coverage is uneven in many real systems, especially across older portal
flows and newer high-volume API paths.

Questions to answer:

- What would you instrument first?
- What alerts catch customer impact before customers report it?
- How would you separate inference-plane incidents from product-layer
  incidents?
- What operational maturity is necessary before enterprise expansion?

### Multi-Tenancy

Customer data is logically tenant-scoped. As the surface area grows, the
risk becomes accidental cross-tenant reads, writes, logs, metrics, or
support tooling exposure.

Questions to answer:

- Where should tenant isolation be enforced?
- What defense-in-depth is worth the complexity?
- How should reviewers and tests catch tenant-boundary mistakes?
- What changes at 10x or 100x account count?

### Resilience And Abuse

The product layer fronts both humans and high-volume machine traffic.
It needs sane timeout behavior, retry contracts, backpressure,
rate-limiting, DDoS posture, and graceful degradation when dependencies
slow down.

Questions to answer:

- Which dependency failures should degrade the portal vs block it?
- Where do circuit breakers and queues belong?
- How do you avoid retries amplifying incidents?
- What is different about defending agent traffic?

## Customer Signals

Assume the team has heard these themes repeatedly:

1. Enterprise buyers want SSO, SCIM, RBAC, and auditability.
2. Developers want account-level usage and spend visibility they can
   query programmatically.
3. Machine users need clearer rate-limit, retry, and error contracts.
4. Agents are increasing both traffic unpredictability and authorization
   ambiguity.
5. Support load rises when customers cannot self-debug request failures.

## Your Task

Read [recommendations.template.md](recommendations.template.md) and make
the case for what you would change, in what order, and why. We are not
looking for a perfect answer. We are looking for experienced judgment:
what you prioritize, what you defer, what you buy, what you build, and
where your conviction comes from.
