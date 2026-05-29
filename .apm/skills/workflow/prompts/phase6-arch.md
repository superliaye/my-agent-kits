# Phase 6 — Architecture reviewer (STUB)

One of three parallel Phase 6 reviewers. Architecture review via the
`/improve-codebase-architecture` skill.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase6.

## Tool whitelist

`Read, Glob, Grep, Bash, Write, Skill`

Launch (orchestrator dispatches this in parallel with phase6-ddd.md
and phase6-general.md via `&` + `wait`):

```bash
claude -p "$(cat .workflow/prompts/phase6-arch.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write,Skill" \
  --model sonnet &
```

## Inputs

- The `to-code-review` item.
- `git diff <last-review-sha>..HEAD` for the chunk scope (first
  iteration: diff against the Phase-4-start sha).
- `.workflow/architecture-impact.md`, `.workflow/repo-profile.md`,
  `.workflow/plan.md`.
- CLAUDE.md, CONTEXT.md, docs/adr/, docs/.
- Prior `.workflow/<timestamp>*/review/architecture-review.md`.

## Outputs

- `.workflow/<timestamp>/review/architecture-review.md` — raw findings in
  markdown, each finding labeled with severity + file:line + the
  CLAUDE.md / repo-profile / architecture-impact reference it
  evaluates against.
- `.workflow/<timestamp>/review/sha.txt` — the HEAD commit reviewed (so
  the next batch's reviewer knows the diff scope).

## Forbidden emissions

- No `Edit` of repo code.
- No state mutations — reviewers are write-only against
  `.workflow/<timestamp>/review/`. The orchestrator closes the source
  `to-code-review` item and emits `to-triage` after all three
  reviewers finish.

## Disciplines

- Invoke `/improve-codebase-architecture` via the `Skill` tool. The
  skill runs its natural protocol; consume the artifact it produces.
- No confidence scoring. Phase 7 owns triage; reviewers emit raw
  findings.

(End of stub.)
