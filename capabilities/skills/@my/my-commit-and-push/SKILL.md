---
description: Create a git commit and push to remote
allowed-tools: Bash(git:*)
disable-model-invocation: true
added_in: 0.3.0
---

<!-- include: commit-procedure -->

After the commit succeeds, push the branch to its remote tracking branch. If the branch has not been pushed before, set the upstream branch and write a change description following the rules below. Do not fork new branch unless user explicitly asked.

The change description should summarize the cumulative change set relative to the base branch, not only the latest commit. When the branch contains multiple commits, describe their combined outcome.

<!-- include: change-summary-rules -->
