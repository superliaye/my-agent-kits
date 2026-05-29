# `.workflow/state.md` — schema reference

State file format for the `/workflow` skill's orchestrator.

The file is the **canonical source of truth** for loop state. The
orchestrator reads it on every dispatch tick. Humans may edit it
directly between invocations.

## Layout

```
# workflow state

meta:
  schema-version: 1
  ui_work: <true|false>
  phase-9-done: <true|false>
  phase-10-done: <true|false>
  phase-11-done: <true|false>

---
id: item-<NNN>
tag: <tag-value>
status: <status-value>
emitted-by-phase: <int 0-11>
artifact: <relative-path-or-empty>
permissions: <comma-separated-or-empty>
parent: <item-id-or-empty>
title: <one-line summary>
---
id: item-<NNN+1>
...
```

No iteration counter — per-batch identity comes from timestamped
artifact directories at `.workflow/<ISO-timestamp>/` (one per Phase 4
dispatch).

- The `meta:` block lives once, at the top, after the `# workflow state`
  header. Fields use `key: value` syntax with two-space indent.
- Each item is a YAML-like block separated by lines containing only
  `---`. Items have flat key/value fields — no nesting. No multi-line
  values (substantive content lives in artifact files).
- Item IDs are zero-padded three-digit serial numbers. The bootstrap
  item is `item-001`.
- Trailing whitespace is stripped. LF line endings.

## Field reference

### Meta

| Field             | Required | Notes                                                                            |
|-------------------|----------|----------------------------------------------------------------------------------|
| `schema-version`  | yes      | `1` for this revision. Orchestrator refuses to proceed on unknown versions.      |
| `ui_work`         | yes      | `true` if scope touches UI files. Determines Phase 3 and Phase 8 eligibility.    |
| `phase-9-done`    | yes      | Set by Phase 9 on completion. Gates Phase 9 re-dispatch.                         |
| `phase-10-done`   | yes      | Set by Phase 10 on completion. Gates Phase 10 re-dispatch.                       |
| `phase-11-done`   | yes      | Set by Phase 11 on completion. Final state — workflow complete when true.        |

### Item fields

| Field              | Required | Notes                                                                                |
|--------------------|----------|--------------------------------------------------------------------------------------|
| `id`               | yes      | `item-NNN`. Unique. Never reused after closure.                                      |
| `tag`              | yes      | One of the dispatchable tags listed below, or empty for closed-but-archived items.   |
| `status`           | yes      | One of: `pending`, `in-progress`, `done`, `ASK`, `HUMAN`, `DECISION`.                |
| `emitted-by-phase` | yes      | Integer 0–11. Phase that wrote this item. Bootstrap items use 0.                     |
| `artifact`         | no       | Relative path (often into `.workflow/`). Empty for items that have not yet produced. |
| `permissions`      | no       | Comma-separated. Currently supports `skip-eligible`.                                 |
| `parent`           | no       | Item ID this one descends from (e.g., a retry's parent is the failed item).         |
| `title`            | yes      | One-line human-readable summary. ≤ 120 chars. No newlines.                           |

### Tags (dispatchable)

| Tag                                | Dispatched to phase |
|------------------------------------|---------------------|
| `to-plan`                          | 1                   |
| `to-review-plan`                   | 2                   |
| `to-design`                        | 3                   |
| `to-implement`                     | 4                   |
| `code-complete-needs-verification` | 5                   |
| `to-code-review`                   | 6                   |
| `to-triage`                        | 7                   |
| `to-design-critique`               | 8                   |

Items with `status` of `done`, `ASK`, `HUMAN`, or `DECISION` are not
dispatchable regardless of tag.

### Statuses

| Status        | Dispatchable | Meaning                                                                   |
|---------------|--------------|---------------------------------------------------------------------------|
| `pending`     | yes          | Awaiting dispatch. Orchestrator picks these up.                           |
| `in-progress` | no           | Phase agent currently working on it. Orchestrator sets/clears.             |
| `done`        | no           | Phase agent closed it. Should have an `artifact` set (or a justification). |
| `ASK`         | no — pauses  | Escalation to user. Body details live in the artifact.                    |
| `HUMAN`       | no — pauses  | Phase 2 escalation. User input required to close.                          |
| `DECISION`    | no — pauses  | Phase 4/5/7 stall detection. User input required.                          |

### Permissions

- `skip-eligible` — granted ONLY by Phase 7 or Phase 8 on `to-implement`
  items they emit. Permits Phase 4 to later declare skip tags
  (`no-verification-needed`, `no-review-needed`) iff the implemented
  scope matches the small-scope expectation. Items lacking this
  permission MUST route through full Phase 5 + 6 validation.

### Skip tags (set by Phase 4 on closure)

These are not items themselves — they are status markers Phase 4 attaches
to items it just completed to short-circuit downstream dispatch. The
orchestrator reads them on the closed item's record:

- `no-verification-needed` — orchestrator does NOT emit a
  `code-complete-needs-verification` item for this chunk.
- `no-review-needed` — orchestrator does NOT emit a `to-code-review`
  item for this chunk.

Both require the item to have carried `skip-eligible` from Phase 7/8.
The orchestrator rejects skip tags on items without permission.

In the file, skip-tag declarations appear as extra fields on a `done`
item:

```
---
id: item-042
tag:
status: done
emitted-by-phase: 7
artifact: .workflow/iter-3/triage.md#finding-2
permissions: skip-eligible
parent: item-031
title: Fix: rename variable per CLAUDE.md convention
skip: no-verification-needed,no-review-needed
---
```

## Sample bootstrap state

The orchestrator writes this on a fresh `/workflow <text>` invocation:

```
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: pending
emitted-by-phase: 0
artifact:
permissions:
parent:
title: Plan for: <user's free-text request, truncated to 120 chars>
---
```

`ui_work` is initialized to `false` and updated by Phase 1 once the
plan determines whether UI files are in scope.

## Dispatch priority

When multiple items are `pending` with dispatchable tags, the
orchestrator selects in this order:

1. **Lowest tag-priority first.** Tag-priority enforces "one phase at
   a time": a phase's tag must drain fully before lower-priority tags
   dispatch.

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

2. Then lowest `emitted-by-phase`.
3. Then lowest item ID (FIFO).

Phase 6 is the only intra-phase parallel case: a single
`to-code-review` triggers three reviewer sub-agents (arch / ddd /
general) fanned out by the orchestrator via `&` + `wait`.

Phase 4 is BULK: one Phase 4 dispatch implements ALL pending
`to-implement` items in the queue. It emits ONE
`code-complete-needs-verification` covering all closed items that
did not carry `no-verification-needed`.

## Terminal state

When all items have `status` in {`done`} (none `pending`, none
escalated) AND `phase-11-done` is true, the workflow is complete. The
orchestrator exits with summary status.

If `phase-11-done` is false but no actionable or escalated items
remain, the orchestrator runs Phase 9 → 10 → 11 sequentially and sets
each `phase-N-done` flag before exiting.
