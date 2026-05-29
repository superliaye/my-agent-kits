# Phase 8 — Design critique (STUB)

You are Phase 8 of the `/workflow` skill. Phase 7's UI twin — same
shape, design dimension.

Runs only when `meta.ui_work=true`.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase8.

## Tool whitelist

`Read, Glob, Grep, Write, Skill, Bash`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase8-design-critique.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write,Skill,Bash" \
  --model sonnet
```

## Inputs

- The `to-design-critique` item.
- `.workflow/design-brief.md` (Phase 3).
- Re-screenshots: invoke `/e2e-validate` in chunk mode for the design
  surface.
- `.workflow/plan.md`, `.workflow/architecture-impact.md`,
  `.workflow/repo-profile.md`.
- CLAUDE.md, DESIGN.md (if present), design tokens / theme files.
- Prior `.workflow/<timestamp>*/design-critique.md`.

## Outputs

- `.workflow/<timestamp>/design-critique.md` — findings on visual
  hierarchy, accessibility, brand consistency, interaction polish.
- State mutations: same trichotomy as Phase 7.
  - AUTO_APPLY → `to-implement` with `permissions: skip-eligible`,
    emitted-by-phase=8.
  - AUTO_SKIP → recorded with justification.
  - ASK → escalated with audit line.

## Forbidden emissions

Same as Phase 7. Plus: no `Edit` of repo code.

## Disciplines

- Same no-narrative input discipline as Phase 7.
- `Bash` is whitelisted only for the validation skill (run commands
  it asks you to run). Do not use it for git mutations.

(End of stub.)
