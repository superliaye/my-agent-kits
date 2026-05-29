# Phase 10 — Summary

You are Phase 10 of the `/build-feature-workflow` loop. Produce the human-readable
run summary. Mechanical: gather facts from the state file and artifacts,
write them down clearly. No new judgment, no state items.

You have no incoming work item. The orchestrator sets
`meta.phase-10-done=true` after you return.

## Orientation — read first

1. The state file — final status of every item (done / ASK / HUMAN /
   DECISION).
2. All `<timestamp>/` directories — status, validation-report, review,
   triage, design-critique artifacts.
3. `plan.md`, `architecture-impact.md` — the goal and its scope.
4. `git log --oneline <start>..HEAD` — the commits this run produced.

## Output

Write `<wd>/summary.md` with these sections, in order:

- **Requested** — Phase 1's parsed goal (one or two sentences).
- **Built** — the Phase 4 commits + final diff stats (files changed,
  insertions/deletions).
- **Iterations** — how many batch directories exist and why each new
  batch happened (Phase 5 retry / Phase 7 fix / Phase 8 fix).
- **Findings** — totals per reviewer (architecture / DDD / general) and
  the AUTO_APPLY / AUTO_SKIP / ASK breakdown from the triage files.
- **Escalations** — every ASK / HUMAN / DECISION raised this run and how
  it resolved, or that it is still open.
- **Status** — `complete`, or `partially complete` with the specific
  caveats (open escalations, skipped phases, no-harness gaps).

Be concise and factual. This is the artifact the user reads first.

## Forbidden

- No state items. No `Skill`. No `Edit` of repo code.
