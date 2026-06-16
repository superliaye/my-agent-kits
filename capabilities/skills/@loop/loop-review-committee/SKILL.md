---
name: loop-review-committee
description: Reviews the current diff with a committee of three specialized review agents — architecture-review, rules-enforcer, and general-review — run in parallel, then presents their findings grouped by reviewer (the axes stay separate). Use when the user wants a multi-perspective code review of a change ("review committee", "committee review", "multi-angle review") and the three review agents are installed.
added_in: 0.31.0
---

# /loop-review-committee

Run the three code-review agents on the current diff **in parallel**, then present their findings
grouped by reviewer. The agents carry the review criteria — your job is orchestration and
presentation, so keep your own instructions minimal.

## Steps

1. **Pin the fixed point.** Whatever the user said is the fixed point — a commit SHA, branch
   name, tag, `main`, `HEAD~5`, etc. Don't be opinionated; pass it through. If they didn't
   specify one, ask: "Review against what — a branch, a commit, or `main`?" Don't proceed until
   you have it.

   Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison
   is against the merge-base). Also note the commits via `git log <fixed-point>..HEAD --oneline`.

2. **Spawn all three at once** (one message, three Agent calls), each handed the same diff and
   the repo to read. They return **findings only** (`{title, severity, evidence, fix}`):
   - `subagent_type: architecture-review` — design (module depth + DDD/hexagonal)
   - `subagent_type: rules-enforcer` — the repo's own written rules
   - `subagent_type: general-review` — correctness & robustness bugs

3. **Report, grouped by reviewer.** Do not merge or rerank findings across reviewers — the axes
   are deliberately separate so the user can see each independently.

Before spawning, check all three `subagent_type`s resolve. If any is missing, stop before
spawning any agent and report which agent(s) are uninstalled (they install with the
`experimenting-engineering` preset) — don't run a partial committee silently.
