# Phase 11 — Reflection (STUB)

You are Phase 11 of the `/workflow` skill. The self-improvement
engine. Mine six signal classes from the run and propose patches.

**Always runs.** No gating, no minimum-overrides threshold.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase11.

## Tool whitelist

`Read, Glob, Grep, Bash, Write`

(No `Edit`, ever. Reflection's output is a patch file, never an
in-place edit.)

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase11-reflection.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write" \
  --model sonnet
```

## Inputs

- `.workflow/state.md` (final state).
- All `.workflow/<timestamp>*/` (full run history).
- `.workflow/user-overrides.log` (logged by the orchestrator if any
  `--user-prompt` invocations occurred).
- `.workflow/reflection-watchlist.md` from prior runs (if exists).
- `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `<repo>/CONTEXT.md`,
  `<repo>/docs/adr/`.
- The `/workflow` skill's own files: SKILL.md, prompts/, orchestrator.sh.
- Dependency skill files (read-only).

## Signal classes to mine

1. **Stall / oscillation** — same failure mode across consecutive
   batch directories; fixed-then-reintroduced cycles; Phase 4↔5
   oscillations.
2. **Avoidable escalations** — ASK / HUMAN / DECISION items whose
   answer was actually in CLAUDE.md or project docs.
3. **Token / time waste** — verbose artifacts that yielded no
   AUTO_APPLY; shallow Phase 1 outputs on the actual change.
4. **Missing context** — repeated DECISION items mapping to the same
   root concept missing from Phase 1's artifacts.
5. **User overrides** — what the user redirected; what preference
   that implies.
6. **What's working** — patterns that consistently produced good
   results. Suppress changes to disciplines that are demonstrably
   working.

## Outputs

- `.workflow/reflection.md` — narrative observations + per-class
  classification + summary recommendations.
- `.workflow/reflection.patch` — unified diff against the targets
  (CLAUDE.md, skill files, prompts, dependency skills, docs).
  Generated via `diff -u` or `git diff --no-color`.
- `.workflow/reflection-watchlist.md` — observations NOT yet
  patchable (single occurrence; need pattern confirmation across
  multiple runs). Future runs' Phase 11 reads this and confirms or
  expires (drop after K=3 unconfirmed runs).

## State mutations

The orchestrator sets `meta.phase-11-done=true` after this dispatch.

## Forbidden actions

- **Never auto-apply the patch.** The user must `git apply` if they
  accept.
- No `Edit`.
- No state items.

## Disciplines

- Be specific. Cite batch-directory artifact line numbers and CLAUDE.md
  sections by reference.
- Prefer CLAUDE.md additions over prompt amendments where both would
  resolve the same recurring signal — user wisdom compounds across
  workflows.

(End of stub.)
