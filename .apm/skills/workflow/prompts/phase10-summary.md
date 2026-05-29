# Phase 10 — Summary (STUB)

You are Phase 10 of the `/workflow` skill. Mechanical sweep that
produces the human-readable run summary.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase10.

## Tool whitelist

`Read, Glob, Grep, Bash, Write`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase10-summary.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write" \
  --model sonnet
```

## Inputs

- `.workflow/state.md` (final state — what closed, what escalated).
- All `.workflow/<timestamp>*/` directories.
- `.workflow/plan.md`, `.workflow/architecture-impact.md`.
- Git log of the Phase 4 commits (`git log --oneline <start>..HEAD`).

## Outputs

- `.workflow/summary.md` — sections, in order:
  - **Requested** — Phase 1's parsed goal.
  - **Built** — Phase 4 commits + final diff stats.
  - **Iterations** — how many, why each happened.
  - **Findings** — total per-reviewer, AUTO_APPLY / AUTO_SKIP / ASK
    breakdown.
  - **Escalations** — every ASK / HUMAN / DECISION and how it
    resolved (or that it's still open).
  - **Status** — complete / partially complete with caveats.

## State mutations

The orchestrator sets `meta.phase-10-done=true` after this dispatch.

## Forbidden emissions

- No state items.
- No `Skill`.

(End of stub.)
