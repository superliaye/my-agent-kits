---
name: my-aggressive-clean-up
description: "Aggressively remove the dead code left behind after a feature flag, killswitch, experiment flight, or any conditional code path is retired — the orphaned state, types, variables, imports, styles, and comments that existed only to serve the removed branch, plus the repo-wide footprint (duplicate flag checks, now-constant arguments, dead consumer-side reads). Headlines the wrong-branch hazard: which side survives depends on the flag's polarity and terminal value. Use after graduating/retiring/removing a flag or collapsing a conditional, or when asked to clean up thoroughly after a code path is removed."
added_in: 0.36.0
---

# my-aggressive-clean-up

Removing a feature flag, killswitch, experiment flight, or any conditional code path deletes
the *guard* but rarely its *dependents*. The branch collapses; the state, types, variables,
imports, styles, and comments that existed only to serve it are left behind — dead weight
that still compiles and silently rots. This is the aggressive sweep that removes all of it,
so the path is gone with no residue.

You're cleaning up around **one removal** — a flag or path collapsing to a single surviving
side. You may be making the collapse yourself or auditing one already made; either way the
job is the same. Finding *which* flags are ripe to retire, and running any particular
removal tool, are out of scope — you're handed the one path. If it isn't named, ask.

## 1. Pin the surviving branch before deleting anything

Removing a flag collapses a two-branch conditional into one. Which branch survives is decided
by the value the flag holds **forever after it's gone** — not by which branch is newer or
named "new." Get this wrong and you ship the dead path and delete the live one.

First name **this** removal's terminal value: once the flag is gone for good, what does it
evaluate to forever, and is the feature kept or dropped? Then map that to the surviving branch:
- A **kill switch / rollback lever** (true = *disable*) settles **off** when the feature is
  kept (the not-active branch survives) and **on** when the feature is killed for good (the
  disabled branch survives). Read which from the removal you were handed.
- An **enabler** (true = *turn on*) settles **on** when the feature is kept (the true branch
  survives) and **off** when it's dropped.
- Resolve a predicate that wraps another (`isEnabled` defined as `not isKilled`) through its
  **definition**, not its name; account for any negation in the condition itself.

Collapse the conditional — or check an existing collapse — only after you've named the
terminal value and the branch it implies, and verify the surviving side is that one.

## 2. Sweep every changed file for orphans

Mechanical removal leaves dependents behind. In each file the removal touched, hunt and remove:
- **Now-trivial control flow inside the survivor** — a conditional, guard, or early-return in
  the surviving branch that only distinguished it from the deleted one is now always-true (or
  always-false); collapse it and drop the unreachable arm.
- **Dead type/interface fields** — properties or params that existed only to feed the removed
  branch. Remove from the type *and* every caller still passing them.
- **Always-constant values** — a prop or argument now pinned to one value because the branch
  that varied it is gone. If it's local to this file, drop it from the call site and its
  declaration; if it's a shared signature, drop the local pin and defer the declaration change
  to the caller audit in §3.
- **Dead state and variables** — local state whose only writer was inside the removed branch,
  and values destructured or read only there. They can no longer change; remove them and
  their reads.
- **Stale reactive dependencies** — dependency lists of memoized callbacks/effects naming a
  now-removed variable.
- **Unused imports, styles, and assets** — anything (imports, CSS classes, images) referenced
  only from the removed path.
- **Emptied files** — if removing the path leaves only a stub or a lone unused import, delete
  the file and repoint what imported it.
- **Stale comments** — "remove when X graduates" markers and inline branch-narrating comments
  ("when flag on…", "old path"). If one can't be safely resolved, leave it and flag it for a
  human rather than guess.
- **Dead tests and fixtures** — tests, snapshots, or fixtures that only exercised the removed
  branch. They now assert nothing or pin the dead path; remove them or rewrite them to cover
  the survivor.
- **Fallbacks dropped by inlining** — inlining a branch can widen a type (an expression that
  was `x ?? default` becomes bare `x`). If the result is now nullable where the target isn't,
  restore the fallback.

## 3. Widen the sweep to the whole repo

A flag's footprint is repo-wide, so its cleanup boundary is too — the changed files are the
starting point, not the scope.
- **Sweep every reference by the flag's identifier** (key, unique id, env name) across the
  whole repo; graduate duplicate checks in sibling packages or copied code in the same pass —
  a half-graduated flag leaves a split-brain state.
- **Non-code references** — the identifier sweep also surfaces the flag in CI configs,
  build-time env injection, `.env` templates, and infra/launch files; graduate or delete
  those too. If the flag lives in an external dashboard or registry outside the repo, flag it
  for the human — you can't reach it.
- **Audit all callers of a now-constant argument.** When removal pins an argument to a
  constant, check every caller repo-wide: if all pass the same constant (or omit it and the
  default matches), drop the parameter from the signature, its type, and all call sites. If
  any caller differs, leave it and note you audited it.
- **Chase consumer-side dead reads.** Removing a field from a producer leaves dead reads in
  its consumers; cleanup is bidirectional.
- **Retire the flag's own declaration.** Once its last reader is gone, remove the flag from
  wherever it's defined or registered (config, feature-flag registry, constants file) — the
  identifier sweep finds the *checks*, but the declaration may sit under a different key.

## 4. Build to zero

Compile, type-check, and lint every affected package to **zero errors and zero warnings** —
warnings are where unused-symbol orphans surface, so don't tolerate them. Fix and rebuild
until clean. If the package has no build or type-check to lean on, fall back to a repo-wide
search for every symbol you removed — the flag identifier, deleted fields, dropped params —
and confirm zero surviving references before declaring done.

## 5. Stop for review

Leave every change uncommitted so the user sees the full sweep in their diff. Report: the
surviving branch you kept and the polarity that justified it, what you removed, and anything
you flagged as unsafe to clean automatically.
