# DDD with Effect-TS — concepts reference

Reference depth behind the [SKILL.md](../../SKILL.md) runbook, oriented to
how the DDD building blocks land in **Effect-TS**. Read this when the
target repo uses Effect and you need the idiomatic mapping plus the
Effect-specific failure modes worth flagging.

## Mappings (DDD → Effect)

- **Domain Error** → the typed **`E` channel** (`Data.TaggedError`);
  narrow by `_tag`, never by substring-matching a message.
- **Port + DI** → **`Context.Tag` service + `Layer`**; the **`R`
  (Requirements) channel** is the typed dependency set.
- **Deep module / information hiding** → **discharge `Layer`s at the
  module boundary** so the public service's `R` is clean (`never` for
  deps it satisfies itself).
- **Anti-Corruption Layer / interop** → `Effect.tryPromise` /
  `Stream.fromAsyncIterable` at I/O edges (HTTP framework, ORM, external
  SDKs).
- **Repository** → a `Context.Tag` service returning domain records; the
  persistence library stays behind it.

## Effect-specific review cues (flag these)

- **`R` leaked to the composition root** for a dependency a module could
  satisfy itself → interface pollution masquerading as DI; discharge at
  the boundary.
- **Untyped `throw`** in domain/application code instead of a typed `E`.
- **Plain `async`/`Promise`/`AsyncIterable`** in domain/application code
  (allowed only in thin interop adapters at I/O edges).
- **`Layer.succeed(StaticValue)`** where reactive/refreshable config needs
  a *service that reads live state* per call.
- **The error channel carrying transport types only** (e.g. HTTP status)
  with no *semantic* domain error taxonomy — Effect gives the channel, the
  domain owns the meaning.

## Proportionality caveat

Effect's `Layer`/`R` machinery is hexagonal DI; it is *not* extra
ceremony. But adopting it *partially*, on a case-by-case "where it's
slightly nicer" basis, produces an unpredictable paradigm boundary that is
worse than either consistent choice. Treat "Effect by default in daemon
source, plain async only at I/O edges" as a coherent posture; treat
scattered/ad-hoc Effect as a finding.
