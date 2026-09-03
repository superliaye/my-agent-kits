---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
added_in: 0.47.0
upstream: https://github.com/mattpocock/skills
upstream_version: "2026-08-24 (6654f6b)"
---

Implement the work described by the user in the spec or tickets.

Before editing, record `git rev-parse HEAD` as the review fixed point.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review in `worktree` mode against the recorded fixed point so staged,
unstaged, and untracked work is reviewed before any optional commit.

If the user has explicitly authorized staging and committing, commit the work to the current
branch. Otherwise leave it unstaged and report the changed paths; ask before any `git add` or
`git commit`.
