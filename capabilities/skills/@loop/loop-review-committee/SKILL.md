---
name: loop-review-committee
description: Reviews a diff with a committee of three specialized review agents — architecture-review, rules-enforcer, and general-review — run in parallel, then presents their findings grouped by reviewer (the axes stay separate). Defaults to the local change set (uncommitted working tree, else this branch vs its base) when no fixed point is named, so it works non-interactively when an orchestrating agent drives it. Use when the user wants a multi-perspective code review of a change ("review committee", "committee review", "multi-angle review") and the three review agents are installed.
added_in: 0.31.0
---

# /loop-review-committee

Run the three code-review agents on a diff **in parallel**, then present their findings
grouped by reviewer. The agents carry the review criteria — your job is orchestration and
presentation, so keep your own instructions minimal. This works the same whether a human or an
orchestrating agent (e.g. the `/loop-build` build agent) invokes it: with no fixed point named,
it resolves the default below without prompting and returns the grouped findings as its result.

## Steps

1. **Resolve the fixed point and the diff.**
   - **If the caller named a fixed point** — a commit SHA, branch, tag, `main`, `HEAD~5` — use
     it as-is. Diff: `git diff <fixed-point>...HEAD` (three-dot, against the merge-base); commits:
     `git log <fixed-point>..HEAD --oneline`.
   - **Otherwise default to the local change set** — do **not** ask:
     - If the working tree has uncommitted changes, review **those**: `git add -A -N` (so new
       files appear), then `git diff HEAD`. The change set is the local edits.
     - Else (clean tree) review **this branch against its base**: resolve the base as the default
       branch (`git symbolic-ref --quiet --short refs/remotes/origin/HEAD` → e.g. `origin/main`,
       falling back to `main`), then `git diff <base>...HEAD`.

   Only ask the caller when the default is genuinely undeterminable (detached HEAD with no base,
   no commits yet, an empty diff). Otherwise proceed.

2. **Spawn all three at once** (one message, three Agent calls), each handed the same diff and
   the repo to read. They return **findings only** (`{title, severity, evidence, fix}`):
   - `subagent_type: architecture-review` — design (module depth + DDD/hexagonal)
   - `subagent_type: rules-enforcer` — the repo's own written rules
   - `subagent_type: general-review` — correctness & robustness bugs

3. **Report, grouped by reviewer.** Do not merge or rerank findings across reviewers — the axes
   are deliberately separate so the user can see each independently.

Before spawning, check all three `subagent_type`s resolve. If any is missing, stop before
spawning any agent and report which agent(s) are uninstalled — don't run a partial
committee silently.
