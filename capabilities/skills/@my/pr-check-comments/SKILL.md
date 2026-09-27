---
name: pr-check-comments
description: Evaluates active PR review comments and recommends whether to fix them without applying changes or replying. Use when asked to assess review feedback or decide which PR comments need action.
added_in: 0.48.0
---

# Check PR Comments

<!-- include: pr-context -->

Collect active, unresolved review comments and their thread context. Exclude
comments for which the user has explicitly given a "not fix" verdict in this
chat; an agent's earlier recommendation is not a user verdict. Keep these
decisions within the current chat, without cross-chat persistence.

Keep active comments even when their premise is mistaken or their request is
already satisfied; explain that evidence in the verdict.

Read the relevant code, tests, and surrounding contracts before evaluating each
comment. For a straightforward issue, recommend **fix** or **not fix** with a
reason. Where the tradeoffs are unclear, investigate further before offering
options and a recommendation; leave the decision with the user when needed.

For each included comment, report:

- **Comment:** the verbatim text, author, and permalink.
- **If unchanged:** what would break and under what conditions. If there is no
  demonstrated breakage, say so and explain the actual concern, such as
  maintainability or style.
- **Verdict:** fix, not fix, or needs decision, supported by the current code.
  Include the relevant tradeoffs and suggested next step for a decision.

This is evaluation only: leave code changes for the user's subsequent direction.
Reply to review threads or change their status only when the user explicitly
requests it.
