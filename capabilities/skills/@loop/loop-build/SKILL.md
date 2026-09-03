---
name: loop-build
description: "Day-to-day build flow. The resident confirms an agreed plan.md plus acceptance.md, then spawns a build agent that implements the plan, binds acceptance evidence to the current source tree, runs applicable code-review lenses (and UI critics when relevant), incorporates feedback, and returns a structured summary. It consumes prior artifacts without prompting or drafts them from context when invoked cold. Use when the user says \"/loop-build\", asks to build an agreed plan, or resumes after a planning session."
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

Two things must exist before building. Neither has an enforced path — you resolve
them from context and pass them **in the build agent's spawn prompt**.

1. **Plan / spec** — the change to make, with per-item intent.
2. **Acceptance doc** — observable criteria in two blocks:

   ```markdown
   ## Non-visual acceptance     (present whenever behaviour changes)
   - [ ] <observable behavioural outcome> — verify: <cmd / test / assertion>

   ## Visual acceptance          (REQUIRED when the change involves visuals)
   - [ ] <observable UI outcome> — env: web|electron|desktop — at: <route/state>
   ```

   A style-only change carries visual criteria and few non-visual ones; a
   pure-logic change is the reverse. If there is genuinely nothing observable to
   verify, the acceptance step is skipped — but say so explicitly, never silently.

## What the assistant (resident) does

1. **Readiness gate — pick the entry mode.**
   - **Mode A — artifacts exist.** A prior planning session (e.g.
     [`/loop-plan-semiauto`](../loop-plan-semiauto/SKILL.md)) already produced the
     plan and the acceptance doc. Confirm both are present and current → go to
     step 2 with **no user interaction**.
   - **Mode B — invoked cold.** Draft the plan + acceptance doc by reasoning over
     the session context. Resolve as much as you can yourself; use
     `AskUserQuestion` **only** for genuine gaps (an ambiguous requirement, a
     missing acceptance threshold, an irreversible choice). Get the user's nod on
     the drafted plan + acceptance, then go to step 2.

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

       ACCEPTANCE:
       <the acceptance doc or exact acceptance.md path — both blocks>

       REVIEW FIXED-POINT: <base to diff against — e.g. HEAD, main, or the commit before this build>
       REVIEW TARGET: worktree
       REVIEW SPEC SOURCES: <the exact plan.md and acceptance.md paths or their immutable contents>
       ACCEPTANCE ROUND CAP: 3
     `
   })
   ```

   Pass both planning artifacts as the review spec source even when their contents are already
   present under PLAN and ACCEPTANCE. The build agent runs **foreground** (you block on it), so its own nested spawns
   (acceptance, reviewers) are unconstrained by the background depth cap.

3. **Broker escalations.** If the build agent returns **at the round cap with
   failing acceptance** (or any genuine blocker — missing creds, an ambiguous
   requirement it could not resolve, an irreversible choice), surface each item
   with `AskUserQuestion` — lead with the agent's own recommendation — then
   re-spawn the build agent with the resolutions folded into the prompt (and a note
   of what already landed, so it continues rather than restarts).

4. **Relay the structured summary** the build agent returns:

   | Field | Relay as |
   |---|---|
   | `executed` | What was implemented — diff summary, commits, files touched. |
   | `achieved` | Acceptance criteria now passing, with evidence and the accepted source-tree fingerprint. |
   | `still-missing` | Failing/unaddressed criteria + why; anything deferred for you to decide; anything escalated. |
   | `dismissed-feedback` | Feedback the build agent judged and chose not to apply, from any source, + its rationale — **always surface these**, the human may disagree. |
   | `harness-improvements` | Gaps in the acceptance doc, a missing test/visual harness, or friction in the skills/agents/loop itself. |
