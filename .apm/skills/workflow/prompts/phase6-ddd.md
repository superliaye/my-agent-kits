# Phase 6 — DDD reviewer (STUB)

One of three parallel Phase 6 reviewers. Domain-driven-design review
via the `/improve-DDD-architecture` skill (build pending — see
`docs/design/workflow-skill.md` §Q-ddd-skill).

Status: **STUB.**

## Tool whitelist

`Read, Glob, Grep, Bash, Write, Skill`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase6-ddd.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write,Skill" \
  --model sonnet &
```

## Inputs

Same diff scope as the architecture reviewer (`git diff
<last-review-sha>..HEAD`). Plus:

- `.workflow/architecture-impact.md`, `.workflow/repo-profile.md`,
  `.workflow/plan.md`.
- CONTEXT.md (for ubiquitous-language alignment).
- Prior `.workflow/<timestamp>*/review/ddd-review.md`.

## Outputs

- `.workflow/<timestamp>/review/ddd-review.md` — findings on:
  - Anemic domain models
  - Infrastructure leaking into domain layer
  - Aggregate boundaries crossed inappropriately
  - Ubiquitous-language drift vs CONTEXT.md
  - Application services doing domain work
  - Missing anti-corruption layers at external boundaries

## Forbidden emissions

Same as phase6-arch.md: no Edit, no state mutations.

## Disciplines

- Invoke `/improve-DDD-architecture` via the `Skill` tool. If the skill
  is not installed in this environment, emit a finding labeled
  `MISSING-DEP` and write the review based on the embedded DDD
  heuristics in this stub. Reflection (Phase 11) will surface the
  missing dependency.

(End of stub.)
