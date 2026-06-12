# Modular Monolith with DDD (.NET) — concepts reference

Distilled from <https://github.com/kgrzybek/modular-monolith-with-ddd>
(Kamil Grzybek; C# / .NET). Reference depth behind the
[SKILL.md](../../SKILL.md) runbook, oriented to how DDD tactical patterns
land in C#. Read this when reviewing .NET code or reasoning about
module boundaries in a monolith.

## Modular monolith structure & isolation

- Single deployable app, **one assembly per module** (e.g. Meetings,
  Payments, Administration, Registrations, UserAccess).
- **Each module owns its data schema; shared tables are forbidden.** A
  module can be moved to its own database with no code change.
- Each module has its own IoC container + composition root.
- Only the module's `IntegrationEvents` assembly is `public`;
  Application, Domain, Infrastructure are `internal`.
- **Direct method calls between modules are prohibited.** Modules depend
  only on other modules' integration-event contracts and communicate
  **asynchronously via an events bus**.

## Layering within a module (Clean Architecture)

- **Domain** — POCOs, zero infrastructure deps. Aggregates, entities,
  value objects, domain services, domain events. Encapsulation first:
  `private` > `internal` > rarely `public`. Invariants enforced here.
- **Application** — CQRS: commands (writes) and queries (reads)
  separated; handlers via **MediatR**; cross-cutting concerns via
  **decorators**. No business logic — delegates to the domain.
- **Infrastructure** — `DbContext` + migrations, repository impls,
  background jobs (Quartz.NET), integration-event publish/consume,
  Outbox/Inbox tables.

## DDD building blocks in C#

- **Aggregates** — aggregate root enforces the consistency boundary
  (e.g. `MeetingGroup` controls meeting creation + membership and
  invariants like "organizer must have an active subscription").
- **Entities** — identity via `Guid` ids; mutable; tied to an
  aggregate's lifecycle (`Meeting`, `MeetingGroupProposal`).
- **Value Objects** — immutable, no identity, group primitives
  (`MoneyValue`, `MeetingGroupLocation`, `MeetingTerm`); kill primitive
  obsession.
- **Domain Events** — facts that occurred, published by aggregates after
  state change (`NewUserRegisteredDomainEvent`,
  `MeetingCreatedDomainEvent`).
- **Business rules / invariants** — encapsulated as classes implementing
  `IBusinessRule`, checked via `CheckRule(new SomeRule(...))` (e.g.
  "a member cannot attend a meeting twice").
- **Domain Services** — stateless, span multiple aggregates, injected
  into handlers, used sparingly.

## Application patterns (CQRS via MediatR)

- **Commands** — intent to change state; `ICommand` / `ICommand<TResult>`
  (`CreateNewMeetingGroupCommand`).
- **Queries** — intent to read; `IQuery<TResult>`; handlers run **raw
  SQL against denormalized read views** returning DTOs — they bypass the
  domain model.
- **Write path:** Command → handler → domain aggregate → domain events →
  state change. **Read path:** Query → SQL → DTO.
- **Decorators (cross-cutting):**
  - `ValidationCommandHandlerDecorator` — FluentValidation
  - `LoggingCommandHandlerDecorator` — structured logging
  - `UnitOfWorkCommandHandlerDecorator` — commit transaction, mark
    internal commands processed, dispatch domain events.

## Cross-module communication: integration events + Outbox/Inbox

- **Integration events** — contracts only (no behavior), in the module's
  public `IntegrationEvents` assembly (`MeetingGroupCreatedIntegrationEvent`).
- **Outbox/Inbox (reliable async):**

  | Phase | Mechanism | Guarantee |
  |---|---|---|
  | Save | domain event → Outbox table in the same transaction | at-least-once |
  | Publish | worker polls Outbox, publishes to bus, marks processed | idempotent |
  | Receive | integration event → Inbox table in receiver | idempotent |
  | Process | worker polls Inbox, invokes internal command, marks processed | exactly-once per inbox |

- **Internal commands** — module-invoked (not from the API), inherit
  `InternalCommandBase`; used for Inbox processing; marked processed by
  the UnitOfWork decorator to prevent re-execution.

## Rules & anti-patterns emphasized

Mandatory:
1. **Test the domain via its public API only** — no `InternalsVisibleTo`,
   no test-only constructors, no mocking internals.
2. **No shared databases** — schema per module; share via events.
3. **Encapsulation first** — `private` > `internal` > `public`.
4. **Business logic in the domain, not the application** — handlers
   orchestrate, aggregates decide.
5. **Async by default** — no synchronous module-to-module calls.

Rejected:
- Primitive obsession → value objects.
- Direct cross-module method calls → integration events.
- Shared data structures across modules → events + eventual consistency.
- Infrastructure logic in the domain → keep domain POCO.
- Mocking controllable infrastructure in tests → use real DB
  integration tests; system tests poll for async eventual consistency.

## Review cues for .NET DDD code

- A `DbContext`, EF attribute, or `HttpException` inside a domain class →
  infrastructure leaking into the domain.
- A command handler containing business rules → misplaced logic (push to
  the aggregate / a domain service).
- One module `using` another module's `Domain`/`Application` namespace →
  isolation breach (allowed only on `IntegrationEvents`).
- A query handler going through the domain model / repositories → CQRS
  read-path violation (queries should hit read views directly).
- A domain event handler calling another aggregate synchronously →
  should be an integration event through Outbox/Inbox.
