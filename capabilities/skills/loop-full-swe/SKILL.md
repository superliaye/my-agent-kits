---
name: loop-full-swe
description: Autonomous, architecture-aware end-to-end SWE loop. Runs scope -> survey/plan -> implement + multi-perspective review -> summary/retro as ONE dynamic-workflow run that proceeds on its own and only breaks to you when a self-digest finds a decision that genuinely needs a human. Use when the user says "/loop-full-swe <feature>" or wants the full research-to-retro loop in one go. The three stage skills (/loop-research-plan, /loop-build, /loop-retro) run segments of this same engine.
added_in: 0.17.0
---

# /loop-full-swe

The uber loop. One [`loop-swe.js`](loop-swe.js) dynamic-workflow run takes a
feature request from scope-gate through plan, implement + multi-perspective
review, and summary/retro. It is **autonomous by default**: a self-digest agent
classifies every open question into auto-resolved vs needs-human, and the run
only pauses (returns a `gate`) when something genuinely needs you.

`loop-swe.js` is the **shared engine** behind all four loop skills. This skill
owns it; [`/loop-research-plan`](../loop-research-plan/SKILL.md),
[`/loop-build`](../loop-build/SKILL.md), and [`/loop-retro`](../loop-retro/SKILL.md)
launch the same file with different `startFrom`/`stopAfter` args.

## Spawn topology (why it is built this way)

Subagents cannot spawn subagents (`depth=1`,
[docs](https://code.claude.com/docs/en/sub-agents)). So **all fan-out lives in
the script** (a root orchestrator); every `agent()` it spawns is a LEAF that
does one job and never spawns. The main agent (you, running this skill) is the
other root: it launches the workflow and brokers the human gates between runs.

## How to invoke

```
/loop-full-swe build a dark-mode toggle in settings
```

## What the assistant does

1. **Pre-flight.** Confirm the working tree has no uncommitted changes the loop
   would overwrite — the build phase commits code. Run artifacts are written to a
   per-repo folder under your home directory (`~/.loop-swe/<repo-key>/`,
   host-neutral — not under `~/.claude` or `~/.codex`), not the working tree, so
   they never dirty git or need a `.gitignore` entry; the absolute path comes back
   as `artifactRoot` in the gate result.

2. **Launch the engine.** The engine file sits next to this SKILL.md. Launch it
   as a background workflow:

   ```
   Workflow({
     scriptPath: "<this-skill-dir>/loop-swe.js",
     args: { feature: "<the user's request text>" }
   })
   ```

   Tell the user they can watch it live with `/workflows`. **Record the Run ID**
   from the launch result — you need it to resume after a gate.

3. **Branch on the returned `gate`:**

   | `gate` | What it means | What you do |
   |---|---|---|
   | `done` | Ran clean to retro | Relay `summaryMarkdown`; point to `summary.md` and `reflection.patch` under the returned `artifactRoot` (review-only — never auto-applied). If `validation.status` is not `passing`, say so — the build settled without going green. |
   | `plan` | The plan has questions the digest could not resolve | Surface each `needsHuman` item (question + options + recommendation + reversibility). Resolve, then **resume** (step 4). |
   | `build` | A review round surfaced a decision for you | Same as `plan` — surface, resolve, resume. |
   | `distribute-to-issues` | The engine **recommends** splitting — it judged the request several independent features | This is a recommendation, not a verdict. Present the three paths and let the user pick (see [On `distribute-to-issues`, offer the override](#on-distribute-to-issues-offer-the-override)). |

4. **Resolve and resume.** Present the `needsHuman` items with `AskUserQuestion`
   (the engine already gives you each option set + its own recommendation, so
   lead with the recommended choice). Collect answers into a map keyed by each
   item's `id`, then re-launch the SAME engine to continue:

   ```
   Workflow({
     scriptPath: "<this-skill-dir>/loop-swe.js",
     resumeFromRunId: "<the Run ID from step 2>",
     args: { feature: "<same request>", resolutions: { "<id>": "<answer>", ... } }
   })
   ```

   Cached phases replay instantly; the digest re-runs with your answers and
   proceeds. Repeat steps 3–4 until `gate` is `done`.

5. **Never auto-accept the irreversible.** If you ever see a resolved item the
   engine rated `reversibility: hard`, surface it to the user anyway before
   continuing — a hard-to-undo choice is always worth a human glance.

## On `distribute-to-issues`, offer the override

When the engine returns `gate: 'distribute-to-issues'`, it judged the request to
be several independent features and came back with a sequenced `issues[]` (each
with a stable kebab-case `id`, `title`, `body`, and an optional `dependsOn` array
of issue `id`s). **This is a recommendation — never auto-accept it.** A coherent
change that merely spans many files (a rename, refactor, or cleanup) is one loop's
job, not a decomposition; the split is only worth it when the issues are genuinely
independent. Present all three paths with `AskUserQuestion` and let the user choose:

- **Run as ONE loop instead (override the split).** Re-launch the same engine with
  `forceSingleRun: true` — it ignores the bail and proceeds through plan + build as
  a single run:

  ```
  Workflow({
    scriptPath: "<this-skill-dir>/loop-swe.js",
    args: { feature: "<the original request>", forceSingleRun: true }
  })
  ```

  Lead with this when the breakdown looks like one coherent change split by file
  count rather than by genuine independence.
- **Distribute to issues (the engine's recommendation).** Hand the returned
  `issues` to [`/to-issues`](../to-issues/SKILL.md) and stop. Do not implement.
- **Build the whole breakdown now (opt-in).** Drive the sequenced chain in this
  session — see [Building the breakdown chain](#building-the-breakdown-chain-opt-in).

## Building the breakdown chain (opt-in)

The build-out below is pure main-agent orchestration on top of the same gate; the
only engine touch is the `id` field on the issue schema so the breakdown is
topo-sortable by id.

1. **Default stays distribute-only.** The continue is **opt-in**. Unless the user
   asks to build the whole breakdown now, hand the returned `issues` to
   [`/to-issues`](../to-issues/SKILL.md) and stop. Do not implement.

2. **One human checkpoint.** If the user opts in, present the breakdown — each
   issue's `id` + `title` in topo order with its `dependsOn` ids — and ask the
   **single** OK via `AskUserQuestion`: "build all these in order?" This is the
   *only* added human gate. (Each per-issue run's own `plan`/`build` `needsHuman`
   gates still surface, but no *extra* per-issue checkpoint is introduced.)

3. **On OK, write the progress artifact.** Persist a recoverable record at
   `<artifactRoot>/decomposition.md` — the issue list, the resolved topo order, and
   one unchecked box (`- [ ]`) per issue. `<artifactRoot>` comes back **on the
   gate** (every gate returns it), so you recompute no path. The filename is
   constant: a fresh agent resuming after a session death reads
   `<artifactRoot>/decomposition.md`, skips the checked issues, and continues. (One
   decomposition is in flight per repo at a time; a second overwrites the first,
   which is fine for a foreground chain.)

4. **Drive the chain — sequential, topo-ordered.** Topo-sort the issues by
   `dependsOn`, resolving each `dependsOn` entry against the issues' `id`s (not
   titles). **Sequentially** (no parallel, no worktrees), for each *unchecked*
   issue, launch a per-issue build:

   ```
   Workflow({
     scriptPath: "<this-skill-dir>/loop-swe.js",
     args: { feature: "<issue body>", stopAfter: "build" }
   })
   ```

   **Record this run's Run ID** from the launch result — you need it to resume the
   run on a `plan`/`build` gate (the engine doesn't echo it back). It matters only
   within this session; a chain resumed after a crash just re-runs any unchecked
   issue from scratch.

   `stopAfter: "build"` skips each issue's own summary/retro (one retro for the
   whole chain runs at the end). Branch on that run's gate:
   - **`plan` / `build` (needs-human):** surface the items and **stop the chain** —
     downstream issues depend on this one. Resume that run after the human answers
     (`resumeFromRunId` + `resolutions`, as in the top-level **Resolve and resume**
     step), then continue.
   - **`distribute-to-issues` again (issue still too large):** **stop and
     escalate** to the human. This is the **one-level re-decomposition cap** — do
     **not** auto-recurse into a nested breakdown.
   - **`build-done` (committed):** check that issue's box in the progress artifact,
     then move to the next unchecked issue.

5. **One retro at the end.** After every box is checked, run
   [`/loop-retro`](../loop-retro/SKILL.md) **once** over the whole chain (not per
   issue).

**Properties.** Each issue lands as its own commit, so a failure is isolated to
one issue and the rest of the chain is unaffected. The only engine touch is the
`id` field added to the issue schema (so the breakdown is topo-sortable by id);
the chain itself is all main-agent orchestration over the existing gate. The cost
versus internalizing the work is more tokens: each issue re-runs scope/plan for
itself rather than sharing one plan.

## Disciplines (enforced inside every phase agent)

These are injected into every leaf prompt by the engine; restated so you can
audit them:

- **Escalation discipline.** Before flagging anything as needing a human, the
  agent checks `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `CONTEXT.md`,
  `docs/adr/`, `docs/`, and prior run artifacts. Only genuinely unanswered
  questions reach you.
- **Leaf-only.** No agent spawns another agent.
- **Adversarial verification.** Every review finding is independently verified
  against the diff before it can cost an implement round.

## Files

```
capabilities/skills/loop-full-swe/
├── SKILL.md      ← this file
└── loop-swe.js   ← the shared engine (also launched by the 3 stage skills)
```

Artifacts for a run live **outside the repo**, in a per-repo folder under your
home directory: `~/.loop-swe/<repo-key>/` (`<repo-key>` is a lowercased slug of the
repo's absolute path — every non-`[a-z0-9]` character mapped to `-`; on Windows the
home is `%USERPROFILE%`). The path
is **host-neutral** — not under `~/.claude` or `~/.codex` — since run-scratch is
not agent config. A resolver leaf creates it at the start of every run, so the
working tree stays clean — no `.gitignore` entry needed. The absolute path is
returned as `artifactRoot` on every gate.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
The phase agents invoke these via the `Skill` tool:

- Skills: `e2e-validate`, `improve-codebase-architecture`,
  `improve-DDD-architecture`, `design-critique`, `diagnose`,
  `electron-visual-loop`, `web-visual-loop`, `to-issues`.
- Plugins: `ui-ux-pro-max`, `frontend-design`.
