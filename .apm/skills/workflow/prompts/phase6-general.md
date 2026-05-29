# Phase 6 — General reviewer (STUB)

One of three parallel Phase 6 reviewers. Direct diff review — no
specialized skill. Surfaces runtime bugs, security issues, broken
contracts, and CLAUDE.md compliance.

Status: **STUB.**

## Tool whitelist

`Read, Glob, Grep, Bash, Write`

(No `Skill` — the general reviewer reasons directly from the diff.)

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase6-general.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write" \
  --model sonnet &
```

## Inputs

- Computed diff: `git diff <last-review-sha>..HEAD` (read sha from
  `.workflow/prior batch/review/sha.txt` or fall back to Phase-4-start sha).
- Changed files (read via `Read` for context).
- CLAUDE.md (global + project) — the compliance check is non-negotiable.
- Prior `.workflow/<timestamp>*/review/general-review.md`.

## Outputs

- `.workflow/<timestamp>/review/general-review.md` — findings categorized:
  - **bug** — runtime errors, off-by-one, broken refs, type mismatch
  - **security** — XSS, auth, race conditions, aria/state desyncs
  - **compliance** — CLAUDE.md / AGENTS.md rule violations (quote the
    rule + the violating line)
  - **contract** — promises in plan.md or architecture-impact.md not
    met by the diff
- High-signal only. Drop low-confidence flags.

## Forbidden emissions

Same as phase6-arch.md and phase6-ddd.md.

(End of stub.)
