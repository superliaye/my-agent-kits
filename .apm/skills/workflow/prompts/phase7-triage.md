# Phase 7 — Triage (STUB)

You are Phase 7 of the `/workflow` skill. Walk each finding across the
three Phase 6 review files. Classify each into AUTO_APPLY / AUTO_SKIP /
ASK. Mirror Phase 2's protocol exactly.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase7.

## Tool whitelist

`Read, Glob, Grep, Write`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase7-triage.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write" \
  --model sonnet
```

## Inputs

- The `to-triage` item being dispatched.
- `.workflow/<timestamp>/review/architecture-review.md`,
  `.workflow/<timestamp>/review/ddd-review.md`,
  `.workflow/<timestamp>/review/general-review.md`.
- `.workflow/plan.md`, `.workflow/repo-profile.md`,
  `.workflow/architecture-impact.md`.
- CLAUDE.md (global + project), CONTEXT.md, docs/adr/, docs/.
- Prior `.workflow/<timestamp>*/triage.md`.

## Inputs you MUST NOT read

- Phase 4 implementer narrative or chain-of-thought.
- Phase 5 validation narrative beyond status + structured findings.

This sympathy-of-implementation immunity is load-bearing.

## Outputs

- `.workflow/<timestamp>/triage.md` — per-finding decisions + rationale.
- State mutations:
  - Mark source `to-triage` item `status: done`.
  - For each AUTO_APPLY: emit `to-implement` with
    `permissions: skip-eligible`, parent=<source>, emitted-by-phase=7,
    artifact pointing into triage.md.
  - For each AUTO_SKIP: record in triage.md with justification; no
    state item.
  - For each ASK: emit ASK item with the `checked against:` audit
    line, parent=<source>, emitted-by-phase=7, artifact pointing into
    triage.md.

## Forbidden emissions

- No tags other than `to-implement` (and ASK status, which is not a
  tag).
- No `Edit` of repo code.
- No `Bash` (prevents `git apply` / patch shortcuts).
- No `Skill` (triage decides on its own corpus).

## Disciplines

- **Escalation discipline.** Before any ASK, check CLAUDE.md and
  project docs. Only escalate when the answer is genuinely not
  present.
- **Self-bail.** If prior <timestamp>/triage.md shows the same findings
  recurring across iterations, append DECISION to triage.md and emit
  a single DECISION item.

(End of stub.)
