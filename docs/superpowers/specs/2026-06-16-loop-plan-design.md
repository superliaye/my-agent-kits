# loop-plan — design (in progress)

A dedicated **plan/PRD + acceptance** authoring flow that runs *before*
[`/loop-build`](../../../capabilities/skills/@loop/loop-build/SKILL.md), so the build
step consumes ready artifacts instead of making the caller draft them from context
(loop-build's unreliable Mode B). Produces exactly what loop-build wants: a **plan**
and an **acceptance doc** in loop-build's two-block format.

> Status: design grill in progress. This file is the cornerstone — decisions are
> captured as they crystallise. Open questions live at the bottom.

## Scope

- **In:** `/loop-plan-manual`, `/loop-plan-semiauto`, a reusable
  `/grill-with-committee` skill, and generalising the three reviewer agents.
- **Deferred:** `/loop-plan-auto` (fully unattended). Not now — the user is "not
  ready for auto". The auto-on-committee-split policy is intentionally left undecided.

## Topology (locked)

**The resident agent drives everything.** There is *no* orchestrating "plan agent" —
because the grill is interactive and a spawned sub-agent (`Agent(...)`) returns once
and cannot hold a multi-turn dialogue with the user. The resident fans sub-agents out
only for the **autonomous leaves** (parallel research; the answer/review committee).

```
/loop-plan-{manual|semiauto}  (resident skill — drives all phases, the only thing that talks to you)
  1. research   — resident fans out parallel research sub-agents (codebase + web),
                  invokes deep-research where time-sensitive facts pay; synthesises a brief
  2. grill      — manual:   /grill-with-docs        (every question -> you)
                  semiauto: /grill-with-committee   (committee answers; split -> you)
  3. draft      — write plan.md + acceptance.md in loop-build's exact format
  4. review     — spawn the generalised reviewer agents on the ARTIFACTS (not code)
  5. stop       — write artifacts, point the user to /loop-build; NO auto-handoff
```

**Artifacts (locked):** `plan.md` + `acceptance.md` (acceptance in loop-build's exact
two-block format) land in a **per-run folder** `~/.loop-plan/<repo-key>/<run-key>/`
(host-neutral, never dirties git — same convention as `~/.loop-swe/` / `~/.wf/`). `<run-key>`
isolates each run (a topic slug, made unique), so concurrent runs and prior artifacts in the
same repo never collide. The path is **overridable** and **printed in the hand-off** — the
user and `/loop-build` target this run's plan by explicit path (Mode A), never a default
guess. Each `/loop-plan-*` is **invokable alone** and ends by pointing the user at
`/loop-build`; it never spawns the build itself. Chaining plan→build is left to a future
composition.

## Components (locked shape)

- **`/loop-plan-manual`** — research -> `/grill-with-docs` -> draft -> artifact review.
  Human answers every grill question.
- **`/loop-plan-semiauto`** — research -> `/grill-with-committee` -> draft -> artifact
  review. Committee auto-resolves unanimous questions; pauses to the user only on a
  split. "If lucky, no human."
- **`/grill-with-committee`** (reusable, standalone or embedded) — built on
  `/grill-with-docs`. Per round: select a **batch of mutually-independent questions**
  (dependent questions wait for a later batch); frame each question with **2–4 options
  plus an "Other" escape hatch** (exactly like a regular grill); spawn the **3 `@reviews`
  agents to vote** — each told in its spawn prompt to vote (not review) from its lens, per
  `committee-answer-contract`. **Consensus rule:**
  all 3 chose the **same enumerated option -> accept silently**; any split -> escalate;
  **any "Other" vote (by any agent) -> always escalate** (three "Other"s are not
  agreement — the reasons differ). In semiauto, escalation pauses and asks the user.
  Loops batch after batch until nothing is open.
  - **Committee-answer contract** (snippet, sibling of `review-finding-contract`):
    each agent returns, per question, `{ choice: <option-id|"other">, rationale,
    evidence, proposed?: <answer when "other"> }`. Consensus is string-equality on
    `choice` with no `"other"` present.
- **Generalised reviewer agents** — `@code-reviewers` -> `@reviews`. **Names kept**
  (`architecture-review` / `rules-enforcer` / `general-review`) so every
  `subagent_type` reference stays wired; **bodies generalised to review *any* artifact**
  (a code diff, or a plan / PRD / design), not just code — but **review only**, no
  grill-task. Each agent is **self-contained** (no shared lens snippet):
  `architecture-review` applies the experience of `/improve-codebase-architecture` +
  `/improve-DDD-architecture`, `rules-enforcer` discovers and enforces the repo's documented
  rules, `general-review` reasons from first principles — each plus `review-finding-contract`.
  The **grill committee reuses these same agents** — `/grill-with-committee` spawns them to
  *vote* (not review): the agent supplies the **lens** (its body), the caller supplies the
  **task** (vote, per `committee-answer-contract`) in the spawn prompt. So the lens lives in
  **one** place, reused by both committees, while the agents stay review-only — no grill-task
  baked into their bodies, no dead weight during code review.

The shared phases (research, draft, artifact review) are factored into **snippets** so
`-manual` and `-semiauto` don't duplicate scaffolding.

## Cross-references / non-goals

- **`wf-semiauto-grill`** (existing) is a file-based autonomous Workflow that never
  interrogates the user mid-run. Incompatible substrate with the resident-driven,
  interactive design chosen here. We lift its concepts (panel, `assumed`/provenance
  labels) but do not reuse it.
- **`loop-research-plan`** is a stage of the `loop-swe.js` engine; this flow is a
  thin resident-facing skill family like `/loop-build`, deliberately *not* a segment
  of that engine.

## Phase detail

**1. Research (resident-driven fan-out).** The resident fans out parallel research
sub-agents over the codebase and the web, and invokes the `deep-research` skill for
time-sensitive facts worth a deeper dig. It synthesises a brief shaped like a
`wf-research` brief (problem restated · problem-area map at `file:line` · how it works
today · constraints/risks · cited web facts · open questions) — produced
resident-driven, **not** by delegating to the `wf-research` Workflow.

**2. Grill.**

- `-manual`: run `/grill-with-docs` — every question goes to you; CONTEXT.md / ADRs are
  updated inline as decisions crystallise.
- `-semiauto`: run `/grill-with-committee` — the resident frames each batched question
  with options + "Other", the 3 lenses vote, a unanimous enumerated choice accepts, any
  split or any "Other" escalates to you. Inherits grill-with-docs's doc-updating.
  **Dependency-aware batching:** only mutually-independent questions share a batch; a
  question gated on an earlier answer waits for a later batch.

**3. Draft.** Write `plan.md` (the change, per-item intent) and `acceptance.md`
(loop-build's two-block format) from the resolved grill, to `~/.loop-plan/<repo-key>/`.

**4. Artifact review (locked).** The 3 lenses (architecture / rules / first-principles)
review the artifacts in parallel; the resident judges each finding, revises the
artifacts (bounded ~2 rounds), and surfaces any dismissed finding for you to override.
Re-review only when a revision could have introduced a new issue.

**5. Stop.** Point the user at `/loop-build` (Mode A). No auto-handoff.

## Shared structure

`-manual` and `-semiauto` are thin skills over shared **snippets**: the research
fan-out, the draft-to-loop-build-format step, and the artifact-review step are each a
snippet both include — so the only real difference between the two skills is the grill
phase. Two output contracts live as snippets:

- `review-finding-contract` (exists) — the artifact-review output.
- `committee-answer-contract` (new) — the grill-committee vote output.

`/grill-with-committee` also runs **standalone**: given a plan/design to stress-test it
produces a `grill.md` digest of resolved decisions (like `/grill-with-docs`), each with
provenance — `committee` (unanimous) or `human` (escalated).

## Build order

Bottom-up; each slice independently verifiable:

1. **`@code-reviewers` -> `@reviews`** — folder move (names unchanged, so `subagent_type`
   refs stay wired); generalise the 3 agent bodies to **review any artifact, review-only**
   (each self-contained — `architecture-review` via the two `/improve-*` skills); add the
   `committee-answer-contract` snippet.
2. **`/grill-with-committee`** — spawns the three `@reviews` agents to *vote* (lens from the
   agent, vote-task + contract from the spawn prompt); standalone-testable.
3. **Shared snippets** — research fan-out, draft-in-loop-build-format, artifact-review.
4. **`/loop-plan-manual`** — research + `/grill-with-docs` + draft + review.
5. **`/loop-plan-semiauto`** — research + `/grill-with-committee` + draft + review.
6. **Wiring** — preset(s), onboarding (`onboard-capability`), CHANGELOG, FLOW docs.

## Glossary

- **resident** — the main-chat agent running a `/loop-plan-*` skill; the only actor
  that talks to the user. Drives every phase.
- **review committee** — the 3 `@reviews` agents (`architecture-review`,
  `rules-enforcer`, `general-review`) spawned to *review* an artifact (code, or a plan).
- **grill committee** — the three `@reviews` agents spawned by `/grill-with-committee` to
  *vote* on a grill batch — lens from the agent, vote-task + `committee-answer-contract` from
  the spawn prompt.
- **lens** — a fixed perspective (architecture / rules / first-principles) defined **once** in
  each `@reviews` agent; both committees (review and grill) reuse it by spawning that agent.
- **consensus** — all 3 lenses chose the same enumerated option, no "Other".
- **escalate** — hand a question to the user (semiauto) because the committee did not
  reach consensus.
- **artifacts** — `plan.md` + `acceptance.md` under a per-run folder
  `~/.loop-plan/<repo-key>/<run-key>/`; the explicit printed path is the hand-off to
  `/loop-build`.
```