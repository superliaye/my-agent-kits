# Domain-Driven Hexagon — concepts reference

Distilled from <https://github.com/Sairyss/domain-driven-hexagon>
(TypeScript / NestJS oriented). This is reference depth behind the
[SKILL.md](../../SKILL.md) runbook. The runbook is the review lens; read
this when you need fuller detail on a building block.

## Architecture layers

### Domain layer (business-logic core)
- Contains: Entities, Aggregates, Value Objects, Domain Services, Domain
  Events, Domain Errors (custom typed errors, not HTTP exceptions).
- No framework dependencies, no external libraries (rare exceptions), no
  infrastructure details.
- Principle: "Domain layer shouldn't depend on frameworks or access
  external resources directly."

### Application layer (orchestration)
- Contains: Application Services (one per use case), Commands
  (state-changing), Queries (read-only), Ports (interfaces).
- Orchestrates domain logic; transforms scalar types to domain types;
  declares infrastructure dependencies via ports.
- Should NOT contain domain business logic.

### Interface adapters layer (user-facing)
- Controllers (HTTP, CLI, GraphQL resolvers), Request/Response DTOs,
  boundary validation/transformation.
- "One controller per use case is good practice."

### Infrastructure layer (technology)
- Repository implementations, persistence models + mappers, adapters
  (DB, brokers, external APIs), ORM schemas, framework config,
  Anti-Corruption Layers for legacy systems.

## Domain building blocks

- **Entities** — identity (by id); encapsulate logic and state changes;
  protect invariants; equality by id; avoid public setters (use methods
  that enforce validation); validate on construction. Anti-pattern:
  anemic domain model.
- **Aggregates** — cluster of entities + value objects as one unit, with
  one **aggregate root** as the only external gateway; internal entities
  have local identity only; external aggregates referenced by id;
  consistency boundary (all-or-nothing transactional changes); may
  publish domain events.
- **Value Objects** — no identity, immutable, equality by structure;
  encapsulate constraints/validation (Address, Email, Money). Enable
  "making illegal states unrepresentable."
- **Domain Events** — signal that something happened (in-process);
  triggered on aggregate state change; decouple aggregates via
  publish/subscribe; can be persisted for audit; enable wrapping
  cross-aggregate changes in one transaction.
- **Domain Services** — (Evans) "a significant process or transformation
  that is not a natural responsibility of an entity or value object";
  logic spanning 2+ entities; operate on domain types only.
- **Domain Errors** — custom error classes with codes, not HTTP
  exceptions; prefer Result/Either return types over throwing;
  distinguish recoverable (return) from non-recoverable (throw).

## Application building blocks

- **Commands** — intent to change state; should not return business data
  (CQS), only metadata (id/status); executed via a command bus.
  Anti-pattern: commands calling commands → publish events instead.
- **Queries** — intent to read; no side effects; may bypass
  domain/repository and hit the DB directly; executed via a query bus.
- **Application Services** — orchestrate the outside world's interaction:
  fetch entities via ports, run domain logic, coordinate via domain
  services, talk to infra via ports. Should not depend on other
  application services (avoids cycles).
- **Ports** — interfaces declaring infrastructure contracts; enable DI
  (inner never depends on outer) and mocking; design to fit domain
  needs, not to mirror a tool's API; avoid needless abstraction.

## Request/Response DTOs

- **Request DTOs** — the contract clients follow; validation/sanitization
  decorators live here; transformed to a Command/Query before the domain.
- **Response DTOs** — whitelist properties (not blacklist) to prevent
  leaks; plain data, never domain entities; insulate the domain from
  client coupling.
- DTOs are data contracts (backward-compatible); commands/queries are
  serializable method calls — keep them separate.

## Repositories & persistence

- **Repositories** — abstractions over entity collections in storage;
  accept and return domain entities; centralize data access.
- **Persistence models vs domain models** — domain shaped for logic,
  persistence shaped for the DB; a mapper translates; lets you refactor
  the schema without breaking the domain (trade-off: mapper boilerplate).
- **Anti-Corruption Layer** — adapter shielding the domain from
  legacy/external systems; maps external data to domain concepts.

## Modular organization

- **Vertical slicing** (recommended): group by use case
  (`User/CreateUser/{Controller,Service,DTO,Command}`), so files that
  change together live together (Common Closure Principle).
- Each module ≈ a bounded context from the ubiquitous language; modules
  are mini-apps; minimize cross-module interaction; communicate via
  mediator/facade/events, not direct imports; keep modules small.

## Anti-patterns (the review targets)

| Anti-pattern | Why harmful | Fix |
|---|---|---|
| Anemic domain model | logic in services, not entities | entities own their logic |
| Infrastructure leaking into domain | tight coupling; hard to replace framework | ports + DI |
| Primitive obsession | raw strings/ints unvalidated | value objects |
| Illegal states representable | type system allows invalid combos | ADTs / union / typestate |
| Entities without validation | invariant violation; state corruption | validate in constructors; methods not setters |
| Deep inheritance chains | brittle, hard to refactor | 1–2 levels; prefer composition |
| Commands calling commands | tight use-case coupling | publish events; subscribe |
| Leaking domain objects to clients | breaking changes propagate; data leaks | Response DTOs |
| HTTP exceptions in domain | domain shouldn't know context | typed errors; map in adapters |

## Validation vs guarding

- **Validation** (external): DTO decorators reject bad input before the
  domain sees it.
- **Guarding** (internal failsafe): domain objects assume valid input
  and throw if invariants are violated.
- "Invariant violation is exceptional; incorrect external input is not.
  Validate at the boundary, guard at the core."

## When to use (proportionality)

- Good fit: complex business logic, long-term maintainability, multiple
  teams, future microservices.
- Over-engineering: simple CRUD, tight deadline/small team, prototype/MVP.
- "Use as many layers as needed, skip others. Easier to refactor
  over-design than no design."
