---
status: accepted
---

# @wf runs share one runId-keyed directory; runId isolates, repoKey is worktree-invariant

All `@wf` workflows write under `~/.wf/<repoKey>/`. A logical run (e.g. research → grill → plan
over one request) gets a single `runId`; every workflow in that run works under the same
`~/.wf/<repoKey>/runs/<runId>/` and owns a `<skill>/` subfolder. Cross-run state — the feedback
backlog — stays at `~/.wf/<repoKey>/feedback/`, with runId- and skill-prefixed filenames.

## Why

- **Cohesion + collaboration.** Co-locating a run's artifacts lets a downstream workflow read an
  upstream one in place — the grill reads `<runDir>/research/brief.md` without being handed a
  path — and lets a human find everything for one piece of work in one directory.
- **runId is the collision boundary.** Parallel runs never collide because each has a unique,
  shell-minted `runId` (`<slug>-<timestamp>-<pid>`), not an LLM-picked suffix. The orchestrator
  mints it once and passes `runDir` to each child; a standalone skill mints its own.
- **Branch is metadata, not a path.** Branch names are unstable, can contain slashes, and a run
  is not owned by a branch. `runId` already isolates; the branch is recorded for traceability.
- **repoKey is worktree-invariant.** Derived from `git rev-parse --git-common-dir` (shared by
  all worktrees), so the feedback backlog aggregates across worktrees instead of fragmenting per
  checkout.

## Considered and rejected

- **Skill-first layout** (`~/.wf/<repo>/<skill>/runs/<id>/`). Keeps each skill's runs grouped but
  scatters one run's artifacts across skill silos, so workflows can't find each other's outputs
  without being handed explicit paths. Loses the cohesion that makes chaining cheap.
- **Branch / worktree as the namespace.** Isolates by the wrong axis: it fragments the cross-run
  feedback backlog (which is repo knowledge) and breaks on rename/delete and slashes in names.
- **LLM-picked run suffix.** Not collision-proof — two parallel runs can pick the same string.

## Consequences

- Every `@wf` workflow accepts `runDir` and mints a fresh one only when absent; it writes solely
  under `<runDir>/<skill>/`. Durable feedback filenames are `<runId>-<skill>-<seq>-<slug>.md`.
- This is a path-contract change: existing per-skill paths (e.g. `wf-research`'s
  `research/runs/<slug>/`) move under `runs/<runId>/research/`. Skills are retrofitted for
  consistency.
