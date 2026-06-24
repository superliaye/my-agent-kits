---
description: Create a git commit and push to remote
allowed-tools: Bash(git:*) Bash(gh:*)
disable-model-invocation: true
added_in: 0.3.0
---

<!-- include: commit-procedure -->

After the commit succeeds, push it (don't create a new branch unless asked).

By default, write a change description **only on a new branch's first push** (`git push -u`) — summarize the branch's cumulative change against the base branch, not just the last commit, per the rules below. Pushing to a branch that already has an upstream (`main`, or any branch pushed before) is just `git push` with **no description** unless the user asks for one.

<!-- include: change-summary-rules -->

## After a push to main

When the user asked to land the work directly on `main`, tear down its scaffolding once the push succeeds — only what this work owns, and ask first if anything is ambiguous:

- **Branch** — delete the now-merged feature branch, local and its remote if it had one; never `main`.
- **Issue** — close the issue/bug this work resolves (found from the branch name or a commit trailer) on the repo's host, e.g. `gh issue close`, referencing the merge commit.
- **Worktree** — if the work lived in a dedicated git worktree, switch out of it and `git worktree remove` it.
