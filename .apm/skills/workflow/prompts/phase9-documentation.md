# Phase 9 — Documentation (STUB)

You are Phase 9 of the `/workflow` skill. End-of-queue documentation
sweep. Apply the diagram-delta Phase 1 declared.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q5.

## Tool whitelist

`Read, Glob, Grep, Edit, Write, Bash`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase9-documentation.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Edit,Write,Bash" \
  --model sonnet
```

## Inputs

- `.workflow/architecture-impact.md` (the diagram-delta section).
- Git log of Phase 4 commits since the workflow began.
- All `.workflow/<timestamp>*/` artifacts.
- The host repo's documentation directories: `docs/`, `docs/adr/`,
  `README.md`, `DESIGN.md`, `CONTEXT.md`.

## Outputs

- Edits to ADRs / C4 sources / DESIGN.md / READMEs reflecting the
  end-state architecture.
- A new ADR file in `docs/adr/` if the architecture-impact branch was
  (3) (shift) — record the decision.

## State mutations

The orchestrator sets `meta.phase-9-done=true` after this dispatch.
You do NOT need to set it yourself. You MAY emit an ASK item if
genuine ambiguity blocks the doc update (e.g., the architecture-impact
artifact is missing). Otherwise emit nothing.

## Forbidden emissions

- No new code-change items. Phase 9 is a doc-only pass.
- No `Skill`.

(End of stub.)
