# Design: a type-selection step on `/my-mermaid`

Date: 2026-06-25

## Problem

`/my-mermaid` renders a Mermaid diagram and verifies it is legible. It never
decides **which diagram type** to draw. Its input contract is `TARGET` ("new, or
which block to fix"), `GROUND TRUTH`, `DELIVERABLE` — no type field. The agent's
authoring rules are almost all flowchart / `stateDiagram` advice, so in practice
the type is decided implicitly: it defaults to a flowchart. The exotic types
(sequence, ER, quadrant, Sankey, Wardley, …) are never considered.

The skill already owns render-safety (truncation, fonts, ELK). The new value is
the upstream decision: *what to draw*.

## Decision

Add a **type-selection step** to the `/my-mermaid` resident skill, before it spawns
the agent. The agent stays the autonomous render-and-verify leaf — it is just told
which type to draw via a new `TYPE` field on the spawn prompt.

No new skill and no new agent. A head on the existing skill, plus one extra spawn
field.

**Out of scope: cross-platform rendering compatibility.** The skill authors the
best diagram for the source and does not reason about which engine (GitHub, Azure
DevOps, …) renders which type. That was considered and deliberately cut to keep the
step to one job.

## Pick the type — objective by construction

The risk with an embedded type menu is anchoring: hand the model ten types and it
picks the nearest one and never reaches for a better, more specialized type. The
step is built to defeat that, with three moves:

1. **Reason from the source's shape first, before any list.** The model names what
   the information *is* (a sequence of interactions, a hierarchy, magnitudes flowing
   between nodes, a 2×2, a state machine, entities and keys, events over time). The
   type is derived from the shape — a choice made before the menu is read, so the
   menu cannot anchor it.
2. **The embedded list is shorthand, not the catalog.** A small set of common
   shapes (flowchart, sequence, state, class, ER, gantt/timeline, journey, quadrant,
   pie, mindmap) maps obvious shapes to a type for the fast common case. It is
   explicitly labeled non-exhaustive — the catalog is whatever Mermaid registers
   today.
3. **A "is there a more specialized type?" check biases toward the full catalog.**
   Whenever the shape is anything past an obvious flowchart/sequence — or there is
   doubt a fitting type exists — the step reads the live Mermaid registry and scans
   all of it before committing.

So **embedded = fast path for the obvious; fetched registry = the authoritative
catalog, consulted by default whenever the source is not dead-obvious.** The
embedded list's only job is to short-circuit the slam-dunk cases; everything else
goes to the live catalog.

### Why a stable core stays embedded

The menu does two jobs and only one drifts. *Which types exist* drifts (new types
keep landing) and is fetchable. *What each type is for* — the intent → type
mapping — is editorial, is published nowhere machine-readable, and for the common
types is stable for years. So the intent gloss for the common core is embedded
(stable, and the offline-safe fast path), while the set of types that exist is read
live whenever the choice reaches past the core.

## Fetch mechanics

- **The live catalog of types:**
  `https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagram-api/diagram-orchestration.ts`
  registers every type. Caveat: it is source, not a JSON API — the ids are passed
  as imported detector references, so it yields the type *names*; there is no
  machine-readable "types + status" endpoint.
- **What a less-familiar type is for:** its page at
  `https://mermaid.js.org/syntax/<id>.html`.
- **Degradation:** a failed fetch falls back to the embedded shorthand plus model
  knowledge — the step never stalls on a network failure.

## Interaction

The step proceeds silently when one type is clearly best. When two or more types
genuinely fit and would change the message, it presents them with a one-line why
each and the user picks. On an unattended run (e.g. inside a `/full-loop` chain)
with no one to answer, it picks the best fit and notes the alternatives in its
handoff rather than blocking.

**Fixing an existing block** keeps that block's current type unless the source
clearly calls for a conversion; a deliberate conversion is stated before spawning.

## Hand-off to the agent

The spawn prompt gains one field, **TYPE** — the chosen diagram type. The agent
authors that type. For a type its built-in authoring rules don't cover (anything
past flowchart and state), the agent reads the type's syntax page before drafting,
so type-specific grammar arrives with the task rather than being absent. The agent
otherwise stays general — no per-type authoring rules bloat its body; the
render-and-verify loop catches parse errors and clipped labels.

## Scope / non-goals

- Decides *what to draw*; nothing about render-safety (the agent owns that) and
  nothing about cross-platform compatibility (cut).
- No new skill; no new agent.
- The caller naming the type up front skips the step entirely.

## Affected files

- `capabilities/skills/@my-productivity/my-mermaid/SKILL.md` — add the
  type-selection step; `allowed-tools` gains `WebFetch`; spawn contract gains `TYPE`.
- `capabilities/agents/@my-productivity/my-mermaid-agent/AGENT.md` — accept the
  `TYPE` input; read an unfamiliar type's syntax page before drafting.
- Version bump + CHANGELOG entry.
- `test/cases/my-mermaid-type-select.sh` — wiring smoke test (the selection logic
  is instruction behavior, not deployable structure, so the test guards only the
  wiring).
