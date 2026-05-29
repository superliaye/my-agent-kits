# build-feature-dynamic-workflow — orchestration spec

The authoritative description of the dynamic workflow this skill runs.
When `/build-feature-dynamic-workflow <feature>` is invoked, the assistant
hands this spec to the native dynamic-workflow runtime so Claude writes a
JS script that orchestrates the phases below as **one background run**.

This is the single-run, report-at-end adaptation of the
`/build-feature-workflow` state machine
([formal model](../../../docs/design/build-feature-workflow-state-machine.md)).
Where the two differ, this file states the dynamic-runtime behavior.

## Execution model

- **One run, in-session.** The script holds phase results in variables
  and passes artifact paths forward. The script itself has no filesystem
  or shell access; **agents** read, write, and run commands.
- **Artifacts** all live under `.build-feature-dynamic-workflow/` so a run
  can coexist with a `/build-feature-workflow` run.
- **No mid-run pause.** Every escalation the bash version would block on
  becomes a best-effort decision + an entry in
  `.build-feature-dynamic-workflow/decisions.md` (see Decisions protocol).
- **Bounded retries.** Implement/validate and triage-fix loops are capped
  at 3 rounds; an agent detecting a repeated failure mode stops early and
  records an open decision.
- **Concurrency.** Only Phase 6 fans out (3 parallel reviewers). All
  other phases are sequential. Well within the runtime's 16-concurrent /
  1000-total caps.

## Decisions protocol (replaces ASK / HUMAN / DECISION)

Before recording any open decision, the agent MUST check, in order:
`~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `<repo>/CONTEXT.md`,
`<repo>/docs/adr/`, `<repo>/docs/`, and all prior phase artifacts under
`.build-feature-dynamic-workflow/`. Only if the answer is genuinely absent:

1. Append to `.build-feature-dynamic-workflow/decisions.md`:
   ```
   ## <phase> — <short question>
   checked against: <docs consulted>; not found
   assumption: <the choice the agent proceeded with, and why>
   reversibility: <how hard this is to change later>
   ```
2. Proceed on the stated assumption. Never block.

The script collects each phase's decision count and passes it forward;
Phase 10 renders `decisions.md` as the run's **Open decisions report**.

## Shared disciplines (every phase prompt restates these)

- **Research delegation.** SMALL research (single source) inline, cite
  the URL in the artifact. SIZABLE research (multi-source synthesis,
  "is X still maintained" with an uncertain answer) is delegated to a
  dedicated research subagent that emits `.build-feature-dynamic-workflow/research/<slug>.md`
  (≤300-word summary + cited URLs) and nothing else. No inline bailout.
- **No-narrative input.** Phase 7 and Phase 8 agents never receive
  implementer chain-of-thought. They reason from review findings +
  Phase 1 artifacts + project docs only.

## Phase graph

```
1 Plan
2 Plan review
3 Design                     (only if ui_work)
4 Implement  ┐
5 Validate   ┘ retry ≤3 (5 fail → back to 4)
6 Code review (3 parallel: arch ‖ ddd ‖ general)
7 Triage      ┐ AUTO_APPLY → back to 4→5→6→7, ≤3 rounds
              ┘ stable (0 AUTO_APPLY) → continue
8 Design critique           (only if ui_work; same fix loop, ≤3)
9 Documentation
10 Summary (+ render Open decisions report)
11 Reflection (writes reflection.md + reflection.patch; never applies)
```

`ui_work` is decided by Phase 1 and threaded through the script as a
variable; the script skips Phases 3 and 8 when it is false.

---

### Phase 1 — Plan (architecture-aware)

- **Goal:** not "find debt" — determine what the requested change *means
  to the existing architecture*. Three-branch decision: no impact /
  doable within current architecture / requires an architectural shift.
- **Inputs:** the user's feature text; the live repo; project docs
  (CLAUDE.md, CONTEXT.md, docs/adr/, DESIGN.md, ARCHITECTURE.md).
- **Outputs (under `.build-feature-dynamic-workflow/`):** `research.md`,
  `repo-profile.md` (conventions with file:line evidence),
  `architecture-impact.md` (branch + state delta + taste-preservation
  contract), `plan.md` (chunked implementation steps + success criteria;
  `REVIEW:` markers for points needing plan review).
- **Sets:** `ui_work` (true/false).
- **Single-run adaptation:** a branch-3 architectural question that the
  bash version would pre-plan ASK on → Decisions protocol, proceed on the
  most reversible assumption.
- **Tools:** `Read, Glob, Grep, Write, WebSearch, WebFetch`.

### Phase 2 — Plan review (separate context)

- **Goal:** independent review of `plan.md` `REVIEW:` markers, with the
  architectural judgment Phase 1 may have rationalized past.
- **Inputs:** `plan.md` + Phase 1 artifacts + project docs. Not Phase 1's
  reasoning narrative.
- **Outputs:** resolves `REVIEW:` markers in place (CLOSE) or records
  unresolved ones via Decisions protocol.
- **Tools:** `Read, Glob, Grep, Write`.

### Phase 3 — Design (only if ui_work)

- **Goal:** thin orchestrator that composes with the installed design
  skill; encodes no design opinions itself.
- **Process:** discover + invoke the installed design skill
  (`ui-ux-pro-max`, then `frontend-design`, `design-critique`) via the
  `Skill` tool, follow its protocol inline, emit `design-brief.md`.
- **Inputs:** `repo-profile.md`, `plan.md`, any `DESIGN.md`/tokens/theme.
- **Outputs:** `design-brief.md`; design `REVIEW:` items → Decisions
  protocol.
- **Tools:** `Read, Glob, Grep, Write, Skill`.

### Phase 4 — Implement (bulk)

- **Goal:** implement all pending plan items as one batch.
- **Inputs:** `plan.md`, `architecture-impact.md`, `design-brief.md` (if
  present), the live repo.
- **Outputs:** code edits (committed per logical chunk), a batch dir
  `.build-feature-dynamic-workflow/<ISO-timestamp>/status.md`.
- **Gap policy:** if a plan step is not unambiguously executable, do NOT
  invent — apply the Decisions protocol (record assumption + proceed).
- **Tools:** `Read, Glob, Grep, Edit, Write, Bash`. No web research
  (Phase 1's job); no `Skill`.

### Phase 5 — E2E validate

- **Goal:** verify the code runs AND meets Phase 1 success criteria
  (not just "compiles").
- **Process:** invoke `/e2e-validate` (chunk mode) via `Skill`.
- **Status → script action:**
  | status | action |
  |---|---|
  | `E2E Validated and Passing` | proceed to Phase 6 |
  | `E2E Validation Failed: Code Errors` | loop to Phase 4 (round ≤3) |
  | `E2E Validated but Requirements Unmet` | loop to Phase 4 (round ≤3) |
  | `Unable to Validate: No Harness` | Decisions protocol; proceed to Phase 6 noting unverified |
- **Self-bail:** on the same failure mode twice, stop the loop and record
  an open decision instead of a 3rd attempt.
- **Outputs:** `<timestamp>/validation-report.md`.
- **Tools:** `Read, Glob, Grep, Skill, Write, Bash`.

### Phase 6 — Code review (3 parallel reviewers)

- **Fan-out:** three subagents in parallel, each writing one file under
  `<timestamp>/review/`:
  | reviewer | skill | output |
  |---|---|---|
  | architecture | `/improve-codebase-architecture` | `architecture-review.md` |
  | ddd | `/improve-DDD-architecture` | `ddd-review.md` |
  | general | none (direct `git diff` review) | `general-review.md` |
- **Diff scope:** `git diff <phase4-start-sha>..HEAD`.
- **No confidence scoring, no JSONL.** Raw markdown findings; Phase 7
  aggregates.
- **Tools:** arch + ddd: `Read, Glob, Grep, Bash, Write, Skill`. general:
  `Read, Glob, Grep, Bash, Write`.

### Phase 7 — Triage (no-narrative)

- **Inputs:** the three review files + Phase 1 artifacts + CLAUDE.md /
  CONTEXT.md / docs/adr/. NOT implementer narratives.
- **Trichotomy per finding:**
  - `AUTO_APPLY` → schedule a fix in the next Phase 4 round, with the
    finding text + which review file + justification.
  - `AUTO_SKIP` → record in `<timestamp>/triage.md` with rationale.
  - escalate → Decisions protocol (with `checked against:` audit line).
- **Loop:** AUTO_APPLY fixes route back through 4 → 5 → 6 → 7, capped at
  3 rounds. When a round yields zero AUTO_APPLY, triage is stable.
- **Tools:** `Read, Glob, Grep, Write`.

### Phase 8 — Design critique (only if ui_work)

- **Goal:** Phase 7's UI twin on the *final, post-triage* code.
- **Process:** same trichotomy on design dimensions (visual hierarchy,
  accessibility, brand consistency, interaction polish); may invoke
  `/e2e-validate` for re-screenshots. Same ≤3 fix loop.
- **Inputs:** `design-brief.md`, screenshots, Phase 1 artifacts, design
  docs. No-narrative discipline applies.
- **Tools:** `Read, Glob, Grep, Write, Skill, Bash`.

### Phase 9 — Documentation

- **Goal:** update ADRs / C4 / DESIGN.md per Phase 1's diagram delta to
  match what shipped.
- **Tools:** `Read, Glob, Grep, Edit, Write, Bash`.

### Phase 10 — Summary

- **Goal:** human-readable end-of-run artifact: request / what was built
  / rounds taken / findings breakdown / status — and **render
  `decisions.md` as the Open decisions report**.
- **Outputs:** `.build-feature-dynamic-workflow/summary.md`.
- **Tools:** `Read, Glob, Grep, Bash, Write`.

### Phase 11 — Reflection (self-improvement)

- **Goal:** mine the run for stalls, repeated failures, avoidable open
  decisions, token waste, missing context, and what worked. Propose
  patches to CLAUDE.md, this skill, dependency skills, and project docs.
- **Outputs:** `reflection.md` + `reflection.patch` +
  `reflection-watchlist.md`. **Never auto-applied** — the user reviews.
- **Tools:** `Read, Glob, Grep, Bash, Write`.

## What the final run returns to the session

One report (not a turn-by-turn transcript): the contents of
`summary.md`, the **Open decisions report** (`decisions.md`), and a
pointer to `reflection.patch` for review. Code changes are already
committed by Phase 4; artifacts remain under
`.build-feature-dynamic-workflow/` for inspection.
