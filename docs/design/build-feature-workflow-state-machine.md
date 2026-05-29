# `/build-feature-workflow` state machine — formal model

The contract the orchestrator implements and the test suite verifies.
This document is the spec; [`build-feature-workflow-skill.md`](build-feature-workflow-skill.md) is
the design rationale and decision log; the orchestrator and tests are
the executable artifacts.

If any of those three disagree, this document wins on questions of
state-machine semantics. The design doc wins on questions of intent.
The tests win on questions of observable behavior.

---

## 1. Universe of states

### 1.1 Item tags (dispatchable)

| Tag                                | Phase | Notes                                    |
|------------------------------------|-------|------------------------------------------|
| `to-plan`                          | 1     | Bootstrap items use this.                |
| `to-review-plan`                   | 2     | Emitted by Phase 1.                      |
| `to-design`                        | 3     | Emitted by Phase 1 iff `ui_work=true`.   |
| `to-implement`                     | 4     | Emitted by Phase 1, 3, 5, 7, 8.          |
| `code-complete-needs-verification` | 5     | Emitted by Phase 4 (unless skip-tagged). |
| `to-code-review`                   | 6     | Emitted by Phase 5 on `Passing`.         |
| `to-triage`                        | 7     | Emitted by Phase 6.                      |
| `to-design-critique`               | 8     | Emitted by Phase 6 iff `ui_work=true`.   |

A `pending` item carrying any of these tags is **dispatchable**.

### 1.2 Item statuses

| Status        | Dispatchable | Causes pause |
|---------------|--------------|--------------|
| `pending`     | yes          | no           |
| `in-progress` | no           | no           |
| `done`        | no           | no           |
| `ASK`         | no           | yes          |
| `HUMAN`       | no           | yes          |
| `DECISION`    | no           | yes          |

### 1.3 Item permissions

- `skip-eligible` — may appear on `to-implement` items.

### 1.4 Skip tags (on closed items only)

- `no-verification-needed` — short-circuits the
  `code-complete-needs-verification` emission Phase 4 would normally
  produce.
- `no-review-needed` — short-circuits the `to-code-review` emission
  Phase 5 would normally produce.

### 1.5 Meta state

| Field            | Domain                              |
|------------------|-------------------------------------|
| `schema-version` | `1`                                 |
| `ui_work`        | `true` \| `false`                   |
| `phase-9-done`   | `true` \| `false`                   |
| `phase-10-done`  | `true` \| `false`                   |
| `phase-11-done`  | `true` \| `false`                   |

No iteration counter. Per-batch identity comes from timestamped artifact
directories at `.build-feature-workflow/<ISO-timestamp>/` (Phase 4 creates one per
dispatch). Agents reading prior batches sort directory entries by
timestamp.

---

## 2. Dispatch algorithm (the loop)

```
read state.md
validate schema (refuse on malformed; refuse on unknown schema-version)
enforce invariants  (see §5)

actionable      = { i : i.status == pending  ∧  i.tag ∈ dispatchable_tags }
escalated       = { i : i.status ∈ {ASK, HUMAN, DECISION} }

if actionable ≠ ∅:
  next = pick(actionable)                          # see §2.1
  dispatch_phase_for(next.tag)                     # see §3
  loop

if escalated ≠ ∅:
  EXIT pause                                       # §4

if not phase-9-done:
  dispatch_phase(9); set phase-9-done = true; loop
if not phase-10-done:
  dispatch_phase(10); set phase-10-done = true; loop
if not phase-11-done:
  dispatch_phase(11); set phase-11-done = true; loop

EXIT complete
```

### 2.1 Selection rule

**One phase at a time.** A phase's tag must drain fully before a
lower-priority tag dispatches. Within a phase, items dispatch in FIFO
order. Phase 6 fans out three parallel reviewers on its single
`to-code-review` dispatch (intra-phase parallelism only).

Among dispatchable items, pick by:

1. **lowest tag-priority** (see table below)
2. then lowest `emitted-by-phase`
3. then lowest numeric component of item ID (`item-NNN` → NNN)

**Tag priority:**

| Tag                                | Priority |
|------------------------------------|----------|
| `to-plan`                          | 0        |
| `to-review-plan`                   | 1        |
| `to-design`                        | 2        |
| `to-implement`                     | 3        |
| `code-complete-needs-verification` | 4        |
| `to-code-review`                   | 5        |
| `to-triage`                        | 6        |
| `to-design-critique`               | 7        |

Lower priority number dispatches first. This guarantees the
"one-phase-active" invariant without requiring source-phase
sequencing in prompts.

---

## 3. Per-phase transition table

For each phase, the model specifies: incoming tag, allowed outgoing
tags, forbidden outgoing tags, state-file mutations, and the tool
whitelist used at dispatch.

### Phase 1 — Plan

| | |
|---|---|
| Incoming tag         | `to-plan` |
| Mutations            | Close source item (`status=done`, `artifact=.build-feature-workflow/plan.md`). Set `meta.ui_work`. Emit one `to-review-plan` item per `REVIEW:` marker in plan.md. Emit `to-design` item iff `ui_work=true`. Emit `to-implement` items per plan chunk. |
| Outgoing tags        | `to-review-plan`, `to-design`, `to-implement` |
| Forbidden outgoing   | `code-complete-needs-verification`, `to-code-review`, `to-triage`, `to-design-critique` |
| May emit ASK         | yes — pre-planning ASK on architecture branch (3). |
| `skip-eligible` use  | forbidden on emitted items (per Q-fast-route lock). |
| `iteration` mutation | sets `iteration = 1` on first `to-implement` emission. |
| Tool whitelist       | `Read,Glob,Grep,Write,WebSearch,WebFetch` (no Edit on repo; Write to `.build-feature-workflow/` only). |

### Phase 2 — Plan review

| | |
|---|---|
| Incoming tag         | `to-review-plan` |
| Mutations            | Close source item. May convert `REVIEW:` markers in `plan.md` to `CLOSE`. Items unresolvable by review become `HUMAN`. |
| Outgoing tags        | none (mutation-only phase) |
| May emit ASK / HUMAN | yes (HUMAN for unresolvable plan REVIEWs). |
| `skip-eligible` use  | forbidden. |
| `iteration` mutation | none. |
| Tool whitelist       | `Read,Glob,Grep,Write` |

### Phase 3 — Design

| | |
|---|---|
| Incoming tag         | `to-design` |
| Precondition         | `ui_work=true`. |
| Mutations            | Close source item. Emit `to-implement` items for any design-derived work (e.g., wiring tokens). May leave existing `to-implement` items untouched. |
| Outgoing tags        | `to-implement` |
| Forbidden outgoing   | all except `to-implement`. |
| May emit ASK         | yes (design `REVIEW:` markers escalate as ASK). |
| `skip-eligible` use  | forbidden. |
| Tool whitelist       | `Read,Glob,Grep,Write,Skill` |

### Phase 4 — Implement (bulk)

| | |
|---|---|
| Incoming tag         | `to-implement` (dispatched against the FULL set of pending `to-implement` items — one Phase 4 dispatch implements ALL pending items as a batch, per the "one-phase-at-a-time" rule). |
| Mutations            | Create `.build-feature-workflow/<ISO-timestamp>/` batch directory. Set each implemented item's `status=in-progress` then `done`. Write per-item entries to `.build-feature-workflow/<ISO-timestamp>/status.md`. Optionally attach per-item skip tags. On gap on ANY item: emit `DECISION` item; do NOT close source(s). |
| Outgoing tags        | **`code-complete-needs-verification` (ONE item per Phase 4 dispatch)**, referencing the batch directory and covering all closed items that do NOT carry `no-verification-needed`. If ALL closed items carry `no-verification-needed`, no emission. |
| Forbidden outgoing   | all other dispatchable tags. |
| May emit DECISION    | yes (ambiguity or stall on any item). |
| Skip-tag declaration | may set `skip` field on closed item with values in {`no-verification-needed`, `no-review-needed`} iff source item carried `skip-eligible`. Per-item decision; Phase 4 may declare on some items in the batch and not others. |
| Batch directory      | new `.build-feature-workflow/<ISO-timestamp>/` per dispatch. Used by subsequent phases (Phase 5 reads it; agents reading prior batches sort by timestamp). |
| Tool whitelist       | `Read,Glob,Grep,Edit,Write,Bash` |

### Phase 5 — E2E validate

| | |
|---|---|
| Incoming tag         | `code-complete-needs-verification` |
| Mutations            | Close source item. Per status outcome (see below): emit `to-code-review`, or emit new `to-implement`, or escalate ASK. |
| Outgoing tags        | `to-code-review`, `to-implement` |
| May emit ASK         | yes — `Unable to Validate: No Harness`. |
| `skip-eligible` use  | forbidden. |
| Tool whitelist       | `Read,Glob,Grep,Skill,Write,Bash` |

Status outcomes:

| `validation-report` status              | Mutation                                           |
|-----------------------------------------|----------------------------------------------------|
| `E2E Validated and Passing`             | emit `to-code-review` referencing the same chunk.  |
| `E2E Validation Failed: Code Errors`    | emit new `to-implement` (parent = source's parent).|
| `E2E Validated but Requirements Unmet`  | emit new `to-implement` (parent = source's parent).|
| `Unable to Validate: No Harness`        | emit `ASK` item; do not emit `to-implement`.       |

### Phase 6 — Code review (three parallel reviewers)

| | |
|---|---|
| Incoming tag         | `to-code-review` |
| Mutations            | Close source item. Emit a single `to-triage` item referencing the batch directory at `.build-feature-workflow/<timestamp>/review/`. |
| Outgoing tags        | `to-triage` |
| Forbidden outgoing   | all others (including `to-design-critique` — Phase 7 owns that emission). |
| Fan-out              | bash orchestrator spawns 3 subprocess agents in parallel and `wait`s. The intra-phase parallelism is the only multi-agent dispatch in the loop. |
| Tool whitelists      | arch + ddd reviewers: `Read,Glob,Grep,Bash,Write,Skill`. general reviewer: `Read,Glob,Grep,Bash,Write`. |

### Phase 7 — Triage

| | |
|---|---|
| Incoming tag         | `to-triage` |
| Mutations            | Close source item. For each finding: AUTO_APPLY → new `to-implement` item with `permissions=skip-eligible`, `parent=source`. AUTO_SKIP → record in triage.md, no item. ASK → new `ASK` item with `checked against:` audit line. **On final run** (this dispatch produced zero AUTO_APPLY items) AND `ui_work=true`: also emit one `to-design-critique` item referencing the latest batch directory. |
| Outgoing tags        | `to-implement`, `to-design-critique` |
| May emit ASK         | yes. |
| `skip-eligible`      | MAY grant on AUTO_APPLY items (one of two phases that can). |
| Tool whitelist       | `Read,Glob,Grep,Write` |

**Why Phase 7 (not Phase 6) emits `to-design-critique`:** Phase 8
should evaluate the FINAL post-triage code, not pre-triage code that
Phase 7-driven Phase 4 may rewrite. Phase 7 knows when triage is
stable (zero AUTO_APPLY this round) — that's the right moment to
trigger design critique. Per "one-phase-at-a-time," Phase 7 fully
drains its derived `to-implement` chain (through Phase 4 → 5 → 6 → 7
again) before its non-AUTO_APPLY final run emits `to-design-critique`.

### Phase 8 — Design critique

| | |
|---|---|
| Incoming tag         | `to-design-critique` |
| Precondition         | `ui_work=true`. |
| Mutations            | Mirror of Phase 7 on the design dimension. |
| Outgoing tags        | `to-implement` |
| May emit ASK         | yes. |
| `skip-eligible`      | MAY grant (other of two phases). |
| Tool whitelist       | `Read,Glob,Grep,Write,Skill,Bash` |

### Phase 9 — Documentation

| | |
|---|---|
| Trigger              | queue empty + all earlier phases done + `phase-9-done=false`. |
| Mutations            | Edit ADRs / C4 / DESIGN.md per Phase 1's diagram delta. Set `meta.phase-9-done=true`. May emit ASK on genuine ambiguity. |
| Outgoing tags        | none. |
| Tool whitelist       | `Read,Glob,Grep,Edit,Write,Bash` |

### Phase 10 — Summary

| | |
|---|---|
| Trigger              | `phase-9-done=true` + `phase-10-done=false`. |
| Mutations            | Write `.build-feature-workflow/summary.md`. Set `meta.phase-10-done=true`. |
| Outgoing tags        | none. |
| Tool whitelist       | `Read,Glob,Grep,Bash,Write` |

### Phase 11 — Reflection

| | |
|---|---|
| Trigger              | `phase-10-done=true` + `phase-11-done=false`. |
| Mutations            | Write `.build-feature-workflow/reflection.md` + `reflection.patch` + update `reflection-watchlist.md`. Set `meta.phase-11-done=true`. |
| Outgoing tags        | none. |
| Tool whitelist       | `Read,Glob,Grep,Bash,Write` |

---

## 4. Pause condition (exit-to-user)

The orchestrator exits to pause iff:

```
∄ pending item with dispatchable tag
∧ ∃ item with status ∈ {ASK, HUMAN, DECISION}
```

The orchestrator never exits to pause while at least one item is
actionable. This is the **best-effort-before-pause** rule: mixed
batches (some actionable, some escalated) drain the actionable queue
fully before pausing.

When re-invoked with free-text args while paused, the orchestrator
embeds the args as `--user-prompt` on the next dispatched phase. The
phase agent (typically the one that emitted the escalated items)
re-processes them.

---

## 5. Invariants

These hold at every quiescent step (between dispatches). The test
suite asserts each.

### 5.1 Progress invariant

If ≥1 dispatchable item is `pending`, the orchestrator dispatches it
on this tick. It does not exit to pause and does not enter the
Phase 9–11 terminal sweep.

### 5.2 Pause correctness

The orchestrator exits to pause ONLY when both conditions hold:

- no `pending` items have a dispatchable tag, and
- ≥ 1 item has status in `{ASK, HUMAN, DECISION}`.

### 5.3 Completion correctness

Phase 9 → 10 → 11 runs ONLY when:

- no `pending` items have a dispatchable tag, and
- no items have status in `{ASK, HUMAN, DECISION}`, and
- the corresponding `phase-N-done` flag is `false`.

Each completion phase runs at most once per terminal sweep.

### 5.4 Skip-eligible authority

An item with `permissions` containing `skip-eligible` is valid only if
`emitted-by-phase ∈ {7, 8}`. The orchestrator REFUSES to dispatch
(refuses the state file entirely) when this is violated.

### 5.5 Skip-tag authority

An item with `skip` field declaring `no-verification-needed` or
`no-review-needed` is valid only if its `permissions` field contains
`skip-eligible`. The orchestrator REFUSES the state file on violation.

### 5.6 Batch directory uniqueness

- Each Phase 4 dispatch creates a new `.build-feature-workflow/<ISO-timestamp>/`
  directory. The timestamp is generated at dispatch entry; uniqueness
  comes from monotonic mtime + sub-second granularity in the filename.
- All items implemented in a single Phase 4 dispatch share that
  directory.
- Subsequent batches (Phase 5 retry, Phase 7 AUTO_APPLY, Phase 8
  AUTO_APPLY) each get their own fresh directory on their next Phase 4
  pickup.
- Self-bail (Q-no-caps) agents read prior batch directories sorted by
  filename (== sorted by mtime since timestamps are ISO-8601). No
  counter to maintain.

### 5.7 Idempotent restart

Running the orchestrator on an unchanged state file with no pending
dispatchable items and no escalations (i.e., terminal state) is a
no-op. Running on a paused state file (escalations only) without
`--user-prompt` is a no-op.

### 5.8 Source-phase audit

Every item has `emitted-by-phase` set to an integer in `[0, 11]`. The
orchestrator REFUSES the state file on missing or malformed values.

### 5.9 No-orphan invariant

Every `done` item has a non-empty `artifact` field OR a `skip` field.
The orchestrator REFUSES the state file on `done` items that satisfy
neither.

### 5.10 Escalation audit

Every `ASK` / `HUMAN` / `DECISION` item has a non-empty `artifact`
field that points to the audit text (the "checked against:" line per
Q-escalation-discipline). The orchestrator REFUSES on missing audit.

### 5.11 Single-in-progress

At most one item has `status=in-progress` at any quiescent step. The
orchestrator clears stale `in-progress` markers on entry (treats them
as a crash and reverts to `pending` for the same item).

### 5.12 Schema gate

The orchestrator refuses any state file whose `schema-version` is not
`1`. It also refuses unparseable files; the state is left untouched.

---

## 6. Liveness scenarios

The test suite exercises each. Mocked phase agents emit predetermined
state-file mutations; the orchestrator's dispatch decisions are
captured and compared to the expected sequence.

### 6.1 Happy path (ui_work=true)

```
fresh → Phase 1 → Phase 2 (all CLOSE) → Phase 3
     → Phase 4 (multi-chunk) → Phase 5 (Passing)
     → Phase 6 (3 reviewers parallel) → Phase 7 (all AUTO_SKIP)
     → Phase 8 (all AUTO_SKIP) → Phase 9 → 10 → 11 → done
```

### 6.2 Non-UI happy path

Same as 6.1 with `ui_work=false`: Phase 3 skipped, Phase 8 skipped.

### 6.3 Phase 2 HUMAN + resume

Phase 1 emits 2 `to-review-plan` items. Phase 2 leaves one as `HUMAN`.
Orchestrator pauses. User re-invokes `/build-feature-workflow <text>`. Orchestrator
re-dispatches Phase 2 with `--user-prompt`. HUMAN closes. Continue.

### 6.4 Phase 5 failure → retry

Phase 5 emits `Code Errors`. Orchestrator emits new `to-implement`.
Phase 4 retries (creates new timestamp directory), Phase 5 passes,
continue. Verify: at least two `.build-feature-workflow/<timestamp>/` directories
exist, both preserved.

### 6.5 Phase 7 mixed batch (best-effort before pause)

Phase 7's triage.md yields 3 AUTO_APPLY (skip-eligible) + 2 ASK.
Phase 4 processes the 3, declares `no-verification-needed` +
`no-review-needed`. Items close. Only THEN does the orchestrator pause
on the 2 ASK items. Verify: pause did not happen mid-batch.

### 6.6 Skip-tag denied path

Phase 7 emits AUTO_APPLY with `skip-eligible`. Phase 4 implements but
finds scope larger than expected — does NOT declare skip tags.
Item routes through full Phase 5 + 6 + 7. Verify: a
`code-complete-needs-verification` item appears.

### 6.7 Phase 4 DECISION escalation

Phase 4 hits unresolvable ambiguity. Emits DECISION item, does NOT
close source. Orchestrator pauses. User resolves. Phase 4 re-dispatches
with `--user-prompt`. Continues.

### 6.8 Self-bail stall termination

Phase 5 returns `Code Errors` on the second batch with the same
failure mode as the first. Phase 4 (third batch dispatch) reads the
prior `<timestamp>/plan-attempt.md` files sorted by mtime, recognizes
the stall, emits DECISION. Orchestrator pauses.

### 6.9 Phase 1 branch-3 (architecture shift)

Phase 1 emits ASK pre-planning question. Orchestrator pauses. User
resolves. Phase 1 re-dispatches with `--user-prompt`, finalizes
plan.md, emits downstream items.

### 6.10 Validation no-harness

Phase 5 returns `Unable to Validate`. ASK item emitted. Pause. User
re-invokes (e.g., adds harness, then prompts continuation). Phase 5
re-dispatches.

### 6.11 Parallel Phase 6 reviewers

Three subprocess agents run truly in parallel. Each writes its own
output file. `wait` blocks correctly. Failure in one does not
poison the others. Orchestrator aggregates outcomes (emits the
single `to-triage` regardless).

### 6.12 Phase 11 patch only

After Phase 10, Phase 11 runs unconditionally → writes `reflection.md`
+ `reflection.patch`. Orchestrator does NOT auto-apply. Verify the
patch file exists and the targets in CLAUDE.md / skill files are
untouched.

### 6.13 Concurrent invocation safety

Two `/build-feature-workflow` invocations race. The second detects the lock and
refuses with a clear error. Verify the first proceeds unmolested.

### 6.14 Partial-write recovery

Simulate SIGKILL mid-phase. State file has `in-progress` item.
Re-invoke detects, reverts the `in-progress` to `pending` (per 5.11),
and continues from there. (No "reset Phase N" prompt in MVP — Phase 4
agent's self-bail discipline handles the re-runs.)

### 6.15 State corruption refusal

Malformed state file (bad tag, missing `emitted-by-phase`, unknown
`schema-version`, skip-eligible from Phase 1, etc.) → orchestrator
refuses to proceed, surfaces a clear error message, leaves state
untouched.

### 6.16 Bounded-step termination (combinatorial fuzz)

A randomized sequence of fixture-driven agent outputs is fed through
the loop. Within a bounded number of dispatches (cap proportional to
fixture queue depth), the loop reaches a terminal state: `done`,
`paused`, or `self-bailed via DECISION`. The loop is never observed to
"continue forever" or to "exit with actionable items still pending."

---

## 7. Concurrency model

- **One orchestrator process per repo at a time.** Enforced via
  atomic-mkdir lock at `.build-feature-workflow/.lock/` (directory, not file). The
  PID lives in `.build-feature-workflow/.lock/pid`. Stale-detect via process
  existence check (`kill -0 <pid>`). `mkdir` is the atomic operation
  on POSIX; TOCTOU-safe.
- **One phase active at a time.** The selection rule's tag-priority
  ordering guarantees only one phase's tag dispatches at any given
  tick. Phase 6 is the only intra-phase parallel case (its three
  reviewer sub-agents fan out via `&` + `wait`, each writing to a
  distinct file in `.build-feature-workflow/<timestamp>/review/`).
- **Phase 4 implements all pending `to-implement` items in one
  dispatch.** This is the bulk-implement rule (Q-phase4 lock per
  decision log). The Phase 4 subprocess processes the queue
  sequentially; the orchestrator does not split the batch across
  multiple Phase 4 dispatches.
- Each phase agent subprocess is one-shot under `claude -p`. The
  orchestrator does not multiplex sub-conversations.

---

## 8. Test-fixture interface

The orchestrator dispatches phase agents by calling a function that
invokes `claude -p ...`. The function honors
`${BUILD_FEATURE_WORKFLOW_TEST_DISPATCH_HOOK:-claude}`. Tests set the hook to a
fixture script. Production leaves it unset.

The fixture script reads:

- `$1` — phase number (1–11)
- `$2` — incoming item ID (or empty for completion phases)
- env `BUILD_FEATURE_WORKFLOW_FIXTURE_DIR` — directory of recorded responses

It emits the predetermined state-file mutations and a transcript line
(`PHASE=<n> ITEM=<id>`) to `$BUILD_FEATURE_WORKFLOW_TRACE_FILE` for assertion.

A fixture run is **deterministic**: each step picks the next response
from a queue keyed by `(phase, dispatch_count)`. This decouples
orchestrator-logic tests from LLM behavior.

---

## 9. Non-goals (what this model deliberately omits)

- **Item priorities beyond the selection rule.** No "urgent" flag.
- **Cross-iteration item linking beyond `parent`.** The audit chain is
  one-deep; older history lives in `iter-*/` directories.
- **Item editing by phase agents other than the owner.** Phase 4 may
  not retag a `to-triage` item, etc. The orchestrator is the only
  writer outside the owning phase.
- **Tag rewrites.** Once an item is emitted with a tag, the tag does
  not change. Failure paths emit NEW items.
- **Soft caps on iteration count.** Per Q-no-caps; agents self-bail.
- **Schema migration.** Bumping `schema-version` is a deliberate,
  future-only operation. MVP refuses anything but `1`.
