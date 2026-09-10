---
name: loop-build
description: "Day-to-day build flow. The resident confirms plan intent plus a sparse acceptance contract, hashes the exact contract, then spawns a build agent that may refine implementation hypotheses while gating review on bound acceptance and source-state evidence. It handles contract defects, UI critique, conditional code review, and feedback. Use for /loop-build, an agreed plan, or resuming after planning."
added_in: 0.32.0
---

# /loop-build

The everyday build loop. You (the **resident agent**) settle *what ready means*,
hand it to a **build agent**, and broker the few decisions that genuinely need the
human. The build agent owns the loop itself — implement → **acceptance gate** →
critique (on a UI build) → review committee → incorporate → return.

It is a thin resident-facing entry over two nested agents:
[`loop-build-agent`](../../../agents/@loop/loop-build-agent/AGENT.md) and
[`loop-build-acceptance`](../../../agents/@loop/loop-build-acceptance/AGENT.md).

## The contract: a plan or spec + an acceptance doc

Two things must exist before building. Neither has an enforced path — resolve them from context and
pass them in the build agent's spawn prompt.

<!-- include: plan-contract -->

<!-- include: acceptance-contract -->

If there is genuinely nothing observable to verify, keep both blocks and mark them empty so the
acceptance step skips explicitly.

## What the assistant (resident) does

1. **Readiness gate — pick the entry mode.**
   - **Mode A — artifacts exist.** A prior planning session (e.g.
     [`/loop-plan-semiauto`](../loop-plan-semiauto/SKILL.md)) already produced the
     plan and the acceptance doc. Confirm both are present and current → go to
     step 2 with **no user interaction**. Compute the `ACCEPTANCE CONTRACT ID` as the SHA-256 digest
     of the exact acceptance bytes.
   - **Mode B — invoked cold.** Draft the plan + acceptance doc by reasoning over
     the session context. Resolve as much as you can yourself; use
     `AskUserQuestion` **only** for genuine gaps (an ambiguous requirement, a
     missing acceptance threshold, an irreversible choice). Get the user's nod on
     the drafted plan + acceptance, then compute its `ACCEPTANCE CONTRACT ID` and go to step 2.

   If you cannot assemble a plan at all, stop and say so — do not spawn a build
   with nothing to build.

2. **Spawn the build agent**, baking the contract into its prompt:

   ```
   Agent({
     subagent_type: "loop-build-agent",
     description: "build <one-line feature>",
     prompt: `
       PLAN:
       <the agreed plan/spec or exact plan.md path>

       ACCEPTANCE CONTRACT:
       <the exact acceptance.md path or immutable bytes — both blocks>

       ACCEPTANCE CONTRACT ID: sha256:<digest of those exact bytes>

       REVIEW FIXED-POINT: <base to diff against — e.g. HEAD, main, or the commit before this build>
       REVIEW TARGET: worktree
       REVIEW SPEC SOURCES: <acceptance as a separate authoritative source; plan intent/constraints
       as authoritative and implementation hypotheses as context>
       ACCEPTANCE ROUND CAP: 3
     `
   })
   ```

   Pass both planning artifacts as separate review sources even when their contents are already
   present under PLAN and ACCEPTANCE CONTRACT. The direct build agent owns its descendant tree. Await its
   return through a **completion-driven wait**; when the runtime exposes only bounded waits, use the
   longest interval it supports and resume only for a result, escalation, or child-pushed milestone.

3. **Broker escalations.** A `contract-defect` returns immediately instead of consuming acceptance
   rounds; `stale-contract` stops until the exact artifact is confirmed. Present the criterion,
   falsified premise or missing harness, evidence, smallest proposed resolution, and impact. An
   equivalent evidence-recipe substitution needs no approval; changing an outcome or its
   authority/source does. After human confirmation, rewrite the
   acceptance doc to its new current state, compute a new contract ID, and re-spawn; every prior pass
   is invalid. Broker ordinary failures at the round cap and genuine blockers the same way, leading
   with the agent's recommendation and noting what already landed so the build resumes.

4. **Relay the structured summary** the build agent returns:

   | Field | Relay as |
   |---|---|
   | `executed` | What was implemented — diff summary, commits, files touched. |
   | `achieved` | Acceptance criteria now passing, with evidence, contract ID, and accepted source-state attestation. |
   | `still-missing` | Failing/unaddressed criteria + why; anything deferred for you to decide; anything escalated. |
   | `dismissed-feedback` | Feedback the build agent judged and chose not to apply, from any source, + its rationale — **always surface these**, the human may disagree. |
   | `harness-improvements` | Gaps in the acceptance doc, a missing test/visual harness, or friction in the skills/agents/loop itself. |
