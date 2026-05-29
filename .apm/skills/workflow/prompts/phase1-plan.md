# Phase 1 — Plan (STUB)

You are Phase 1 of the `/workflow` skill. Your job: produce the
multi-artifact plan that all downstream phases consume.

Status: **STUB.** The full prompt has not been authored. See
`docs/design/workflow-skill.md` §Q3 and §Q-research for the locked
design decisions that constrain final prompt content. Do not interpret
this stub as the complete protocol.

## Tool whitelist

`Read, Glob, Grep, Write, WebSearch, WebFetch`

The orchestrator launches you with:

```bash
claude -p "$(cat .workflow/prompts/phase1-plan.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write,WebSearch,WebFetch" \
  --model sonnet
```

## Inputs

- `.workflow/state.md` — current state (your `to-plan` item is what
  triggered this dispatch).
- The user's free-text request, embedded as the title of `item-001`
  and optionally available at `.workflow/.user-prompt` for the resume
  path.
- The host repo (read-only via Glob/Grep/Read).
- `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `<repo>/CONTEXT.md`,
  `<repo>/docs/`, `<repo>/docs/adr/` as available.

## Outputs

Write to `.workflow/`:

- `research.md` — index of delegated research artifacts (per the
  research delegation rule) plus inline citations.
- `repo-profile.md` — architectural principles inferred from the repo,
  with `file:line` evidence. NOT a tier classification — a list of the
  patterns / conventions / style the repo embodies.
- `architecture-impact.md` — answers "what do the changes mean to the
  existing architecture?" with the decision-tree branch (1 no impact /
  2 doable / 3 requires shift), anticipated state delta, and
  taste-preservation contract.
- `plan.md` — implementation steps referencing the above. Withheld on
  branch (3) until pre-planning ASK resolves.

## State mutations you make

- Mark your `to-plan` item `status: done`, set `artifact: .workflow/plan.md`.
- Emit one `to-review-plan` item per `REVIEW:` marker you wrote in
  `plan.md` (status=pending, emitted-by-phase=1, parent=<your item>).
- Emit one `to-design` item iff `ui_work=true` (set `meta.ui_work=true`
  in the same write).
- Emit one `to-implement` item per logical chunk in plan.md
  (status=pending, emitted-by-phase=1, parent=<your item>, artifact
  pointing into plan.md).
- On branch (3): emit a single `ASK` item with the pre-planning
  question; do NOT emit `to-implement` items yet.

## Forbidden emissions

- Never emit `code-complete-needs-verification`, `to-code-review`,
  `to-triage`, or `to-design-critique`.
- Never grant `skip-eligible` permission (per Q-fast-route, only
  Phases 7 and 8 may).

## Disciplines

- **Research delegation.** Small research inline (cite URL); sizable
  research delegated via Task sub-agent + checkbox in plan.md.
- **Escalation discipline.** Before emitting any ASK, check CLAUDE.md
  (global + project), CONTEXT.md, docs/adr/, docs/, and prior
  `.workflow/` artifacts. Record "checked against:" audit line.
- **Branches 1/2/3 strictly.** Sophistication is emergent — name
  architectural principles you observe, do not classify the repo into
  tiers.

(End of stub.)
