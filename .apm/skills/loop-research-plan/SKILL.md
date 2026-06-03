---
name: loop-research-plan
description: Cautious, survey-grade research + planning stage of the loop SWE engine. Runs scope-gate + architecture-aware planning, then self-digests the open questions so it surfaces ONLY decisions that genuinely need you (and proceeds silently on the rest). If the work is too large for one build, it hands a breakdown to /to-issues. Use when the user says "/loop-research-plan <feature>" or wants a powerful plan-only pass before committing to a build. Stops before any code is written.
added_in: 0.17.0
---

# /loop-research-plan

The research + plan segment of the shared loop engine
([`loop-swe.js`](../loop-full-swe/loop-swe.js), owned by
[`/loop-full-swe`](../loop-full-swe/SKILL.md)). It scopes the change, writes a
survey-grade plan with file:line architecture evidence and per-item success
criteria, then **self-digests**: only questions the project docs cannot answer
reach you. No code is written — it stops after planning.

## How to invoke

```
/loop-research-plan add an audit log to the settings service
```

## What the assistant does

1. **Launch the engine, plan-only.** The engine lives in the sibling skill
   folder:

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     args: { feature: "<the user's request>", stopAfter: "plan" }
   })
   ```

   Record the Run ID; tell the user to watch via `/workflows`.

2. **Branch on the returned `gate`:**

   | `gate` | Meaning | Action |
   |---|---|---|
   | `plan-done` | Plan is clear, nothing needs you | Relay `.loop-swe/plan.md` and the auto-resolved decisions; tell the user it's ready for [`/loop-build`](../loop-build/SKILL.md). |
   | `plan` | The digest kept open questions for you | Surface each `needsHuman` item (options + recommendation + reversibility) with `AskUserQuestion`, then **resume** (step 3). |
   | `distribute-to-issues` | Too large for one build | Hand the returned `issues` to [`/to-issues`](../to-issues/SKILL.md); do not plan further here. |

3. **Resolve and resume.** Collect answers into a map keyed by each item's `id`,
   then continue the same run:

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     resumeFromRunId: "<Run ID from step 1>",
     args: { feature: "<same request>", stopAfter: "plan", resolutions: { "<id>": "<answer>", ... } }
   })
   ```

   The scope + plan agents replay from cache; the digest re-runs with your
   answers. Repeat until `gate` is `plan-done`.

The plan lands at `.loop-swe/plan.md` (plus `.loop-swe/architecture-impact.md`
for non-trivial tracks), where `/loop-build` picks it up.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
This stage uses `to-issues` (for oversized work) and the project docs; the
heavier review/validate skills are used by [`/loop-build`](../loop-build/SKILL.md).
