---
description: Summarize a set of changes as a reviewer-focused markdown description (e.g. a PR body)
allowed-tools: Bash(git:*)
disable-model-invocation: true
added_in: 0.26.0
---

Review the full change set — use `git status`, inspect both staged and unstaged diffs, and, when summarizing a branch, review its commits and cumulative diff against the base branch — then write a Markdown summary following these rules:

<!-- include: change-summary-rules -->
