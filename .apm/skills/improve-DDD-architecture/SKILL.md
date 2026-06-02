---
description: Review code against domain-driven design and hexagonal architecture principles. Surfaces anemic models, infrastructure leaking into the domain, aggregate-boundary violations, ubiquitous-language drift, misplaced business logic, and missing anti-corruption layers. Use when the user wants a DDD review, asks whether code follows DDD/hexagonal/ports-and-adapters, or as the DDD reviewer in /build-feature-workflow Phase 6.
added_in: 0.14.0
upstream: https://github.com/Sairyss/domain-driven-hexagon
---

# Improve DDD Architecture

Review code through a domain-driven, hexagonal lens. The aim is a domain
layer that speaks the business's language, owns its rules, and stays
ignorant of frameworks and I/O.

This SKILL.md is the **runbook** — the distilled DDD vocabulary, layer
rules, and review heuristics. Treat it as the source of truth, not your
trained recollection of DDD. Deeper reference material is in
[references/](references/) (the Domain-Driven Hexagon corpus). When you
need more than the runbook gives, read those — don't reconstruct DDD
from memory.

## Ubiquitous language first

Names are the load-bearing artifact. If the repo has a `CONTEXT.md`,
the domain's terms live there. Every finding should be phrased in those
terms. A name in the code that disagrees with `CONTEXT.md` (or with the
team's own consistent usage) is itself a finding: **language drift**.

## The layers (the review skeleton)

| Layer | Contains | Must NOT contain |
|---|---|---|
| **Domain** | Entities, Aggregates, Value Objects, Domain Services, Domain Events, Domain Errors | Frameworks, ORM/HTTP/SQL types, I/O, external libraries |
| **Application** | Application Services (one per use case), Commands, Queries, Ports (interfaces) | Domain business rules; direct infrastructure access |
| **Adapters (interface)** | Controllers (HTTP/CLI/GraphQL), Request/Response DTOs, boundary validation | Business logic |
| **Infrastructure** | Repository impls, persistence models + mappers, external adapters, config adapters (behind consumer-owned ports), ACLs | Domain rules |

**Dependency rule:** inner layers never depend on outer layers. The
domain depends on nothing; the application depends on the domain and on
ports (interfaces it owns); infrastructure implements those ports.

**Layers are roles, not folders.** In a **functional-core modular
monolith**, the four layers are **roles played by files within a vertical
module slice**, not physical folders (e.g. a module's `types.ts` =
domain; `service.ts`/`executor.ts` = application; `store.ts`/`schema.ts`
= infrastructure; controllers live in a shared adapter module). Map files
to layer *roles*; do **not** flag the lack of `domain/`/`application/`/
`infrastructure/` folders as a violation. The dependency rule still
applies — enforced by import direction within the module.

## Building blocks (what each is, and how it fails)

- **Entity** — identity + behavior; protects invariants; equality by
  id; no public setters. An entity may be a **data record + behavior in
  module-scoped functions** (functional core) rather than a class with
  methods. This is *not* anemic. Anemic is when logic that belongs to the
  entity is scattered into **unrelated** services far from its data. Flag
  only the latter. *Fails as:* anemic (logic that belongs to the entity
  scattered into unrelated services).
- **Value Object** — no identity, immutable, validates a domain concept
  (Email, Money, Address). *Fails as:* primitive obsession (raw
  strings/ints passed around unvalidated).
- **Aggregate** — a cluster with one **root**; the consistency
  boundary; external access only through the root; other aggregates
  referenced **by id**, not object reference; changes are
  transactional. *Fails as:* reaching across aggregate boundaries,
  mutating another aggregate's internals.
- **Domain Service** — logic spanning 2+ entities that belongs to no
  single one; operates only on domain types. *Fails as:* a dumping
  ground for logic that belongs on an entity.
- **Domain Event** — "something happened"; decouples aggregates
  (publish/subscribe) instead of one calling another. *Fails as:*
  absent, so aggregates call each other directly.
- **Domain Error** — custom typed errors, not HTTP exceptions; domain
  doesn't know HTTP/CLI context. *Fails as:* throwing framework
  exceptions from the domain.
- **Command / Query (CQS)** — commands change state and return no
  business data; queries read and have no side effects; queries may
  bypass the domain and hit the DB directly. *Fails as:* commands
  calling commands (should publish events), queries with side effects.
- **Application Service** — orchestrates one use case: fetch entities
  via ports, run domain logic, coordinate via domain services, talk to
  infra via ports. *Fails as:* containing business rules, or depending
  on other application services (cyclic).
- **Port** — an interface the application owns, shaped to the domain's
  needs (not the tool's API). Infrastructure provides the adapter. A port
  is **owned by the consumer and shaped to its need**, not a mirror of the
  provider's full surface. *Configuration as infrastructure*: a consumer
  that needs settings depends on a narrow port it owns (e.g.
  `ModelDefaults`), and the config source is the adapter that implements
  it — never a wide dependency on the whole config module, never a
  reached-for global. For reactive config, the port is a *service that
  reads live state* (not a snapshot value). *Fails as:* the port
  mirroring a vendor SDK; or needless abstraction with a single
  forever-adapter.
- **Repository** — collection-like abstraction over storage; accepts
  and returns domain entities; a mapper translates to/from persistence
  models. *Fails as:* leaking ORM entities as domain models.
- **Anti-Corruption Layer** — translates an external/legacy model into
  domain concepts at a seam. *Fails as:* external models used raw
  across a context boundary.

## Review process

1. **Locate the layers.** Map the changed files to domain /
   application / adapter / infrastructure — by **role**, not by folder
   name (a vertical module slice plays all four; see *Layers are roles,
   not folders*). If the repo isn't layered, that's context — note it;
   don't impose ceremony a simple CRUD app doesn't need (see
   *Proportionality*).
2. **Read `CONTEXT.md`** (and ADRs) for the ubiquitous language and
   prior decisions. Don't re-litigate settled decisions.
3. **Walk the diff against the checklist** below. For each hit, record
   a finding: severity + `file:line` + the principle + a one-line
   "why it matters" in domain terms.
4. **Phrase fixes as direction, not patches.** This skill surfaces and
   explains; it does not edit code.

## Review checklist (the heuristics)

- [ ] **Anemic model** — business logic for an entity living in
      *unrelated* services, far from its data. (A functional core — data
      record + co-located module functions — is healthy, not anemic.)
- [ ] **Infrastructure in the domain** — ORM/HTTP/SQL/framework imports
      inside domain classes.
- [ ] **Primitive obsession** — domain concepts passed as raw
      strings/numbers instead of value objects.
- [ ] **Aggregate boundary violation** — cross-aggregate object
      references or internal mutation instead of by-id + events.
- [ ] **Misplaced logic** — business rules in application services,
      controllers, or repositories.
- [ ] **Language drift** — code names disagree with `CONTEXT.md` / the
      team's consistent usage.
- [ ] **Missing ACL** — external/legacy models used raw across a
      boundary.
- [ ] **HTTP leaking into domain** — framework exceptions or status
      codes thrown from domain code.
- [ ] **CQS violations** — commands returning business data or calling
      commands; queries with side effects.
- [ ] **Leaky DTOs** — domain entities serialized straight to clients
      (use Response DTOs; whitelist fields).
- [ ] **Dependency-rule inversion** — a domain or application module
      importing from infrastructure.
- [ ] **Wide cross-module dependency** — depending on a provider module's
      *full* public interface instead of a narrow, consumer-owned port;
      or reading configuration via a global instead of a port + adapter.

## Proportionality

DDD is for complex domains. For simple CRUD, a thin slice, or a
prototype, full layering is over-engineering — say so rather than
inventing violations. "Use as many layers as the domain needs; it's
easier to refactor over-design than no design." Calibrate findings to
the repo's actual complexity (and to `architecture-impact.md` when run
inside `/build-feature-workflow`).

- **Classify the domain first.** *Rule-rich* domains (invariants,
  calculations, policy — e.g. billing, scheduling) reward **tactical**
  DDD: aggregates protecting invariants, value objects, domain services.
  *Coordination-rich* domains (orchestration, I/O, integration, streaming
  — e.g. an agent runtime, a gateway) reward **strategic** DDD and ports,
  and treat heavy tactical machinery as ceremony. Calibrate findings
  accordingly: do not invent aggregate/VO findings in a coordination-rich
  repo.
- **Architecture is the lines, not the boxes.** The high-leverage,
  hard-to-reverse decisions are the *relationships between bounded
  contexts* (the context map) and the *seam contracts*, not the internal
  models. Weight findings there.
- **Subdomain distillation.** Spend modeling effort on **Core**
  subdomains; build **Supporting** plainly; **buy/wrap Generic** ones.
  Flag effort lavished on a generic/technical subdomain (e.g. lovingly
  hand-crafting a provider-SDK wrapper) as misallocated.
- **Strategic DDD is almost always worth keeping** even when tactical DDD
  is over-engineering: ubiquitous language, bounded contexts, a context
  map, and anti-corruption layers at external seams. Encourage these
  regardless of the tactical calibration.

## Output

- **Standalone:** present findings grouped by severity, each with
  `file:line` and the principle, then a short "top issues" summary.
- **Inside `/build-feature-workflow` Phase 6:** write raw findings (no confidence
  scores) to the review file the phase prompt specifies; Phase 7
  triages. Do not mutate build-feature-workflow state — the lead reviewer does the
  bookkeeping.

## References

- [references/domain-driven-hexagon/concepts.md](references/domain-driven-hexagon/concepts.md)
  — distilled from github.com/Sairyss/domain-driven-hexagon
  (TypeScript-oriented). The fuller corpus for deep dives.
- [references/dotnet/concepts.md](references/dotnet/concepts.md) —
  distilled from github.com/kgrzybek/modular-monolith-with-ddd (C# /
  .NET): module isolation, per-module Clean Architecture, CQRS via
  MediatR, Outbox/Inbox messaging, and .NET-specific review cues.
- [references/effect/concepts.md](references/effect/concepts.md) —
  Effect-TS mappings for the DDD building blocks (typed `E` channel,
  `Context.Tag` + `Layer`, the `R` requirements channel) and
  Effect-specific review cues. Read this when the target repo uses
  Effect.
