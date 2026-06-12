---
description: Read, evaluate, and act on the review comments on the current branch's PR, then report back
allowed-tools: Bash(git:*) Bash(gh:*)
disable-model-invocation: true
added_in: 0.26.0
---

Work through the open review comments on the pull request for the current branch.

**1. Read the comments.** Work out the remote host and the right tool from `git remote -v` and what the environment provides — for example GitHub via `gh pr view --comments` or `gh api`, GitLab via `glab`, Azure DevOps via `az repos pr`. Find the PR for the current branch and collect its open review comments and threads. If there is no PR, or no tool/credentials to read comments, stop and tell the user.

**2. Evaluate each comment** and sort it into one of three buckets:
   - **Accept and fix** — correct, in scope, and straightforward to apply.
   - **Resolve or won't-fix** — already addressed, out of scope, a misunderstanding, or a deliberate choice; something a reply can settle without a code change.
   - **Needs the user** — a genuine judgment call, a larger design decision, or anything you are not confident resolving on the user's behalf.

**3. Apply the accepted fixes.** Make the code changes for the "accept and fix" comments, then commit them with a concise message and push, so the PR updates with the fixes.

**4. Reply and update each thread's status.** Post a brief reply on every comment you handled (what you changed, or why it won't change), then set the thread to the most accurate status the host supports: **resolved** for the ones you fixed or that are genuinely settled, and a distinct **won't-fix** status where the host offers one (e.g. Azure DevOps) instead of flattening won't-fix into "resolved." If the host has no won't-fix state (e.g. GitHub review threads only resolve), put the reason in the reply and resolve the thread.

**5. Report back.** Summarize:
   - **Fixed** — which comments you accepted, what you changed, and that it is committed and pushed.
   - **Resolved / won't-fix** — which you closed with a reply, and the reason for each.
   - **Needs your input** — the remaining controversial comments, each with the specific question or decision it raises and any follow-up required.
