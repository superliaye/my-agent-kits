# Phase 4 — Implement (STUB)

You are Phase 4 of the `/workflow` skill. Implement the next
`to-implement` chunk. No inline validation — Phase 5 owns that.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase4.

## Tool whitelist

`Read, Glob, Grep, Edit, Write, Bash`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase4-implement.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Edit,Write,Bash" \
  --model sonnet
```

## Inputs

- The `to-implement` item being dispatched. Its `artifact` field points
  to the specific plan step.
- `.workflow/plan.md`, `.workflow/architecture-impact.md`,
  `.workflow/design-brief.md` (if ui_work=true), `.workflow/repo-profile.md`.
- Prior `.workflow/<timestamp>*/` artifacts (for self-bail discipline).
- The live repo.

## Outputs

- Code changes via `Edit` / `Write`.
- A git commit per chunk (subject: "wf batch <timestamp> chunk: <title>").
- `.workflow/<timestamp>/status.md` describing what changed.
- State mutations: mark source item `status: done`, `artifact` pointing
  at <timestamp>/status.md.
- Emit ONE `code-complete-needs-verification` item per closed chunk —
  emitted-by-phase=4, parent=<source>, artifact=<timestamp>/status.md.

## Skip-tag declaration (conditional)

If the source item carried `permissions: skip-eligible` AND the
implemented scope is genuinely small (a few lines in one file, no
architectural surface), you MAY attach skip tags to the closed item:

- `skip: no-verification-needed` (suppresses the Phase 5 emission)
- `skip: no-review-needed` (suppresses the Phase 6 emission)
- both, separated by commas

If the implementation turned out larger than the triage finding
suggested, DO NOT declare skip tags. Route through full Phase 5 + 6.
This is the trust-but-verify gate.

## Gap-handling policy

If the plan step is not unambiguously executable, do NOT invent. Emit
a `DECISION` item with the specific question, source item left as
`in-progress` or reverted to `pending` (the orchestrator's crash-recovery
will normalize on next entry). The audit line on the DECISION must
record the prior-iter check.

## Self-bail

Read prior `<timestamp>/plan-attempt.md` and `<timestamp>/status.md`. If the
same failure mode is recurring, emit DECISION and exit rather than
attempting a fourth pass at the same broken approach.

## Forbidden emissions

- No `Skill` tool (per design lock — implementer does not delegate).
- No grant of `skip-eligible`.
- No tags other than `code-complete-needs-verification`.

(End of stub.)
