---
name: loop-swe-build
description: "DEPRECATED — the implement + multi-perspective-review stage of the loop-swe engine. Implements the plan in bounded rounds, runs parallel cross-discipline reviews (architecture, DDD, general, and design when UI), adversarially verifies each finding, and autonomously incorporates the confirmed ones — surfacing ONLY review decisions that genuinely need you. Kept as the build segment of /loop-full-swe; for the day-to-day build flow use the new /loop-build instead. Use when the user says \"/loop-swe-build\" and a plan already exists — in the conversation, a file they name, or a previously saved loop-swe plan — to start the implement+review stage directly, without running /loop-research-plan first."
added_in: 0.17.0
deprecated: true
---

# /loop-swe-build

> **Deprecated.** This is the implement+review *segment of the `loop-swe.js`
> engine*, kept only because [`/loop-full-swe`](../loop-full-swe/SKILL.md),
> [`/loop-research-plan`](../loop-research-plan/SKILL.md), and
> [`/loop-retro`](../loop-retro/SKILL.md) still drive it. For the everyday "build
> from an agreed plan" flow, use the new **[`/loop-build`](../loop-build/SKILL.md)**
> skill (resident agent → build agent → acceptance gate → review committee), which
> is **not** a segment of this engine.

The implement + review segment of the shared loop engine
([`loop-swe.js`](../loop-full-swe/loop-swe.js), owned by
[`/loop-full-swe`](../loop-full-swe/SKILL.md)). It implements the pending items
in the run's `plan.md` in bounded rounds, fans out parallel cross-discipline
reviewers, **adversarially verifies** each finding against the diff, and
autonomously folds the confirmed `auto-apply` fixes back in. Only review
decisions the digest cannot resolve reach you.

**Plan source:** `/loop-swe-build` builds from a plan you **already have** — it
does NOT require `/loop-research-plan` to have run. It resolves the plan in order:
an existing saved `plan.md` (in the artifact root, see step 1), a plan file you
name, or the plan in the **current conversation** (see Pre-flight). Inside
`/loop-full-swe` the plan carries in-run automatically.

## How to invoke

```
/loop-swe-build
```

## What the assistant does

1. **Resolve the artifact root, then resolve the plan and write it to
   `<root>/plan.md`.** The loop-swe artifact root is a per-repo folder under your
   home directory (host-neutral — **not** under `~/.claude` or `~/.codex`, and
   **not** in the repo, so nothing here dirties git or needs a `.gitignore`
   entry). Resolve it with the same recipe the engine uses (so the build phase
   reads the same file): `<HOME>/.loop-swe/<key>`, where `<HOME>` is `$HOME` (or
   `%USERPROFILE%` on Windows) and `<key>` is the absolute path from `git rev-parse
   --show-toplevel`, trimmed, lowercased, with every character outside `[a-z0-9]`
   replaced by `-` (e.g. `D:/Repos/My-App` -> `d--repos-my-app`). Create it
   (`mkdir -p`) if missing. Then resolve the plan, in order:
   - If `<root>/plan.md` already exists, use it as-is.
   - Else if the user named a plan file (e.g. `docs/some-plan.md`), write its
     content to `<root>/plan.md`.
   - Else take the plan from the **current conversation** and write it to
     `<root>/plan.md` as a checklist of still-pending items, each with its
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
   | `build-done` | Implemented + reviewed clean | Relay what was built and the auto-applied fixes; if `validation.status` is `no-harness`, flag that the change shipped with no e2e harness to validate it. Then it's ready for [`/loop-retro`](../loop-retro/SKILL.md). |
   | `build` | A review finding, or e2e-validate still failing at the round cap, needs your decision | Surface each `needsHuman` item with `AskUserQuestion`, then **resume** (step 4). |

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
