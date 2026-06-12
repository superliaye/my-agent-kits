---
description: Commit, push, and open a pull request on the repo's remote host
allowed-tools: Bash(git:*) Bash(gh:*)
disable-model-invocation: true
added_in: 0.3.0
---

Take the current branch all the way to an open pull request: commit, push, then open the PR. Do each step, but skip any that is already done — skip the commit if the working tree is clean, skip the push if the branch is already up to date on the remote.

<!-- include: commit-procedure -->

After the commit, push the branch to its upstream tracking branch — use `-u` for a new branch.

Then create the pull request on the repo's remote host. Work out the host and the right tool from `git remote -v` and what the environment provides — for example GitHub via `gh pr create`, GitLab via `glab mr create`, Azure DevOps via `az repos pr create`. Open it against the base branch (usually the repo's default branch). If no PR tool or credentials are available, stop and hand the user the title and body so they can open it manually.

For the PR content, summarize the whole branch — every commit and the cumulative diff against the base branch — following the rules below. Derive a concise PR title from the Outcome and use the full summary as the PR body. Pass it as raw Markdown directly to the PR tool (e.g. GitHub renders it as the PR description); do NOT wrap it in a code fence — the fence in the rules is only for copy-paste delivery, which does not apply when the tool sets the body directly.

<!-- include: change-summary-rules -->

Return the PR URL when done.
