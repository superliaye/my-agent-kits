---
name: pr-get-ready
description: Prepares draft PRs for review, advances the next stacked PR after a merge, or checks CI and evaluates comments on ready PRs. Use when asked to make a PR ready or assess what needs attention.
added_in: 0.48.0
---

# Get PR Ready

<!-- include: pr-context -->

Choose the workflow based on the PR's current remote state and draft status.

## Starts merged

Use `git stack ls --all --json` to identify the merged PR's immediate unmerged
child before cleanup. If none exists, report that and stop; if several exist,
ask which to advance. Preserve unrelated work, then run `git stack jump <next-branch>`,
`git stack cleanup`, and `git stack sync --fetch`. Stop on unresolved conflicts.
Resolve the child's PR and apply “Starts in draft” below, using
`git stack push --only` to publish updates and marking it ready only if still
draft. Verify its updated head and base before reporting the next PR's link.

## Starts in draft

Read the PR's purpose, target branch, current head, and diff. Before local
validation or edits, ensure the checkout represents the PR and preserve
unrelated work.

1. Select focused local tests most likely affected by the diff, such as tests
   for changed code and its direct callers. Use the repository's test commands
   to target those tests; leave broad regression coverage to CI. Expand only
   when a focused check reveals a concrete reason. If the change has no
   relevant tests, skip local tests.
2. Run those checks. Fix straightforward failures within the PR's scope and
   rerun the affected checks. If a fix expands scope, defeats the PR's purpose,
   or needs an architectural decision, discuss the next step with the user in
   a TL;DR. If a selected check cannot run, leave the PR in draft and report
   the blocker.
3. Once validation passes, ensure the tested changes are in the PR, committing
   and pushing any fixes. Verify that the PR head still matches the validated
   code, then mark it ready for review. Confirm "Marked ready" with the PR link,
   omit passing-check summaries, and end this invocation.

CI results and reviews arrive later. Do not invoke the skills below or wait for
those results after promoting a draft; a later invocation handles them.

## Starts ready for review

Ensure both skills are installed before proceeding; if one is missing, stop
and name the capability to install. Invoke them as the resident agent, using
their invocable names, with the same PR identity and current-chat context:

1. `/pr-check-ci`
2. `/pr-check-comments` — preserve its required output format in the final user-facing report.

Collect CI blockers and decisions as outstanding results. Complete comment
evaluation wherever it can proceed independently before asking the user to
decide. Present both results together: remaining CI failures, blockers, and
decisions, plus the comment evaluations. Omit passing-check summaries.
