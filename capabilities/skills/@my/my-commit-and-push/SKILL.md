---
description: Create a git commit and push to remote
allowed-tools: Bash(git:*)
disable-model-invocation: true
added_in: 0.3.0
---

<!-- include: commit-procedure -->

After the commit succeeds, push it (don't create a new branch unless asked).

By default, write a change description **only on a new branch's first push** (`git push -u`) — summarize the branch's cumulative change against the base branch, not just the last commit, per the rules below. Pushing to a branch that already has an upstream (`main`, or any branch pushed before) is just `git push` with **no description** unless the user asks for one.

<!-- include: change-summary-rules -->
