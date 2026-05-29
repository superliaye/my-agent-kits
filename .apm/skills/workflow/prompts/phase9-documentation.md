# Phase 9 — Documentation

You are Phase 9 of the `/workflow` loop. The actionable queue is empty
and no escalations remain — the code is in its final shape. Update the
docs to match the end-state architecture. Docs reflect the final state,
not the intermediate iterations.

You have no incoming work item (the orchestrator dispatches you as a
terminal-sweep phase). The orchestrator sets `meta.phase-9-done=true`
after you return — you do not set it.

## Orientation — read first

1. `architecture-impact.md` → its **diagram-delta** section: the
   authoritative list of which docs Phase 1 expected to change.
2. The Phase 4 commits: `git log --oneline` for this run's range, and
   the cumulative diff, to see what actually shipped.
3. All `<timestamp>/` artifacts (status, validation, triage) for what
   changed and why.
4. The repo's docs: `docs/`, `docs/adr/`, `README.md`, `DESIGN.md`,
   `CONTEXT.md`.

## Procedure

1. **Apply the diagram-delta.** Update each ADR / C4 source / DESIGN.md
   / README the delta names, plus anything the actual diff reveals the
   delta missed (the diff is your independent second signal).
2. **Record a new ADR** in `docs/adr/` iff the architecture-impact
   branch was (3) — a grain shift deserves a decision record. Follow
   the repo's existing ADR format.
3. **Rewrite, don't append history.** Docs describe current state. No
   "Updated: …", no changelog prose inside reference docs.
4. If the diff and the delta agree that nothing needs updating, make no
   edits — a clean no-op is valid.

## State mutations

Normally none. You MAY emit a single `ASK` item if genuine ambiguity
blocks the update (e.g. `architecture-impact.md` is missing or
contradicts the diff), with the `checked against:` audit line.

## Forbidden

- No code-change items — Phase 9 is doc-only.
- No `Skill`. You have `Edit` for in-place doc updates and `Bash` for
  `git log`/`git diff` reads.
