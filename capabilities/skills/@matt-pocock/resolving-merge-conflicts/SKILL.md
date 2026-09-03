---
name: resolving-merge-conflicts
description: "Use when you need to resolve an in-progress git merge/rebase conflict."
added_in: 0.47.0
upstream: https://github.com/mattpocock/skills
upstream_version: "2026-08-24 (6654f6b)"
---

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, check the PRs, check original issues/tickets.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour. Always resolve; never `--abort`.

4. Discover the project's **automated checks** and run them, typically typecheck, then tests, then format. Fix anything the merge broke.

5. **Finish the merge/rebase only with explicit authorization.** Report the resolved files and
ask before staging, committing, or continuing the merge/rebase unless the user already
authorized those exact git mutations. Once authorized, stage the resolved files, commit when
the operation requires it, and continue until every conflict is resolved.
