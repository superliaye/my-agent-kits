---
name: loop-build
description: Implement + multi-perspective-review stage of the loop SWE engine. Implements the plan in bounded rounds, runs parallel cross-discipline reviews (architecture, DDD, general, and design when UI), adversarially verifies each finding, and autonomously incorporates the confirmed ones — surfacing ONLY review decisions that genuinely need you. Use when the user says "/loop-build" after a plan exists (from /loop-research-plan), or wants the implement-and-review segment on its own. Reads the plan from .loop-swe/plan.md.
added_in: 0.17.0
disable-model-invocation: true
---

# /loop-build

The implement + review segment of the shared loop engine
([`loop-swe.js`](../loop-full-swe/loop-swe.js), owned by
[`/loop-full-swe`](../loop-full-swe/SKILL.md)). It implements the pending items
in `.loop-swe/plan.md` in bounded rounds, fans out parallel cross-discipline
reviewers, **adversarially verifies** each finding against the diff, and
autonomously folds the confirmed `auto-apply` fixes back in. Only review
decisions the digest cannot resolve reach you.

**Precondition:** run [`/loop-research-plan`](../loop-research-plan/SKILL.md)
first — this stage reads `.loop-swe/plan.md` from disk. (Inside
`/loop-full-swe`, plan state carries in-run and this is automatic.)

## How to invoke

```
/loop-build
```

## What the assistant does

1. **Pre-flight.** Confirm `.loop-swe/plan.md` exists and the working tree is
   clean enough — this stage commits code. If there's no plan, point the user to
   `/loop-research-plan`.

2. **Launch the engine from the build phase:**

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     args: { startFrom: "build", stopAfter: "build" }
   })
   ```

   Record the Run ID; tell the user to watch via `/workflows`. (Scope re-runs
   read-only so the reviewer panel still knows whether the change is UI work.)

3. **Branch on the returned `gate`:**

   | `gate` | Meaning | Action |
   |---|---|---|
   | `build-done` | Implemented + reviewed clean | Relay what was built and the auto-applied fixes; tell the user it's ready for [`/loop-retro`](../loop-retro/SKILL.md). |
   | `build` | A review finding needs your decision | Surface each `needsHuman` item with `AskUserQuestion`, then **resume** (step 4). |

4. **Resolve and resume.** Map answers by each item's `id` and continue:

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     resumeFromRunId: "<Run ID from step 2>",
     args: { startFrom: "build", stopAfter: "build", resolutions: { "<id>": "<answer>", ... } }
   })
   ```

   Prior rounds replay from cache. Repeat until `gate` is `build-done`. Never
   silently accept a `reversibility: hard` item — surface it.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
The reviewer leaves invoke `e2e-validate`, `improve-codebase-architecture`,
`improve-DDD-architecture`, and (for UI work) `design-critique` via the `Skill`
tool.
