---
name: pr-check-ci
description: Investigates PR CI failures, fixes straightforward regressions within scope, and finds existing fixes for failures unrelated to the PR. Use when asked to check or address CI failures on a PR.
added_in: 0.48.0
---

# Check PR CI

<!-- include: pr-context -->

Inspect CI results for the PR's current head. For each failure, read the job's
logs and the relevant PR purpose, diff, code, and tests to determine whether
the PR caused it.

## Caused by the PR

If fixing the failure would expand scope, defeat the PR's purpose, or require
an architectural decision, leave that fix pending for the user. Return a TL;DR
of what fails, why the fix needs discussion, and the recommended next step.
Check whether a failing test exposes a regression or encodes behavior the PR
intentionally changes before deciding how to fix it.

Fix straightforward omissions or regressions within the PR's scope, including
tests missed by local validation. Before local validation or edits, ensure the
checkout represents the PR and preserve unrelated work. Run the relevant
checks, then commit and push the fix under the repository's applicable
permissions.

## Not caused by the PR

Check whether the same issue affects the current target branch, using its
actual name rather than assuming `master`. If it does, look for work by others
that addresses it, including open PRs and recently merged fixes. This includes
broken tests, flaky tests, and CI infrastructure failures.

Report the remaining failure, the evidence linking it to the target branch or
external cause, any existing fix with its link and status, and the recommended
next step. If no existing fix is found, say so. Keep unrelated repairs outside
the PR unless the user expands its scope.

Assess the available results once. Report pending or unavailable checks only
as remaining verification gaps; do not wait for newly triggered CI.
Report only remaining failures, blockers, and decisions. Omit passing-check
summaries.
