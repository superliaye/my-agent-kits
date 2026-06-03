---
name: loop-build
description: Implement + multi-perspective-review stage of the loop SWE engine. Implements the plan in bounded rounds, runs parallel cross-discipline reviews (architecture, DDD, general, and design when UI), adversarially verifies each finding, and autonomously incorporates the confirmed ones — surfacing ONLY review decisions that genuinely need you. Use when the user says "/loop-build" and a plan already exists — in the conversation, a file they name, or .loop-swe/plan.md — to start the implement+review stage directly, without running /loop-research-plan first.
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

**Plan source:** `/loop-build` builds from a plan you **already have** — it does
NOT require `/loop-research-plan` to have run. It resolves the plan in order: an
existing `.loop-swe/plan.md`, a plan file you name, or the plan in the **current
conversation** (see Pre-flight). Inside `/loop-full-swe` the plan carries in-run
automatically.

## How to invoke

```
/loop-build
```

## What the assistant does

1. **Resolve the plan and write it to `.loop-swe/plan.md`.** In order:
   - If `.loop-swe/plan.md` already exists, use it as-is.
   - Else if the user named a plan file (e.g. `docs/some-plan.md`), write its
     content to `.loop-swe/plan.md`.
   - Else take the plan from the **current conversation** and write it to
     `.loop-swe/plan.md` as a checklist of still-pending items, each with its
     success criteria where known.
   - Only if there is genuinely no plan anywhere: say "no plan found — planning
     first, then building" and launch with `{ startFrom: "plan", stopAfter: "build" }`
     instead of the call in step 2.

   Also confirm the working tree is clean enough — this stage commits code.
   Building from your own plan loses nothing: the review gate (multi-perspective
   review → adversarial verify → `needsHuman` digest) runs on the implementation
   regardless of where the plan came from.

2. **Launch the engine from the build phase:**

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     args: { feature: "<one-line summary of the plan, for the scope/uiWork check>", startFrom: "build", stopAfter: "build" }
   })
   ```

   Record the Run ID; tell the user to watch via `/workflows`. (Scope re-runs
   read-only so the reviewer panel still knows whether the change is UI work.)

3. **Branch on the returned `gate`:**

   | `gate` | Meaning | Action |
   |---|---|---|
   | `build-done` | Implemented + reviewed clean | Relay what was built and the auto-applied fixes; tell the user it's ready for [`/loop-retro`](../loop-retro/SKILL.md). |
   | `build` | A review finding needs your decision | Surface each `needsHuman` item with `AskUserQuestion`, then **resume** (step 4). |

4. **Resolve and resume.** Map answers by each item's `id` and continue (pass the
   same `feature` so cached phases replay):

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     resumeFromRunId: "<Run ID from step 2>",
     args: { feature: "<same summary>", startFrom: "build", stopAfter: "build", resolutions: { "<id>": "<answer>", ... } }
   })
   ```

   Prior rounds replay from cache. Repeat until `gate` is `build-done`. Never
   silently accept a `reversibility: hard` item — surface it.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
The reviewer leaves invoke `e2e-validate`, `improve-codebase-architecture`,
`improve-DDD-architecture`, and (for UI work) `design-critique` via the `Skill`
tool.
