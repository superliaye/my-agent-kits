---
name: loop-full-swe
description: Autonomous, architecture-aware end-to-end SWE loop. Runs scope -> survey/plan -> implement + multi-perspective review -> summary/retro as ONE dynamic-workflow run that proceeds on its own and only breaks to you when a self-digest finds a decision that genuinely needs a human. Use when the user says "/loop-full-swe <feature>" or wants the full research-to-retro loop in one go. The three stage skills (/loop-research-plan, /loop-build, /loop-retro) run segments of this same engine.
added_in: 0.17.0
disable-model-invocation: true
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
   would overwrite — the build phase commits code and writes artifacts under
   `.loop-swe/`.

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
   | `done` | Ran clean to retro | Relay `summaryMarkdown`; point to `.loop-swe/summary.md` and `.loop-swe/reflection.patch` (review-only — never auto-applied). |
   | `plan` | The plan has questions the digest could not resolve | Surface each `needsHuman` item (question + options + recommendation + reversibility). Resolve, then **resume** (step 4). |
   | `build` | A review round surfaced a decision for you | Same as `plan` — surface, resolve, resume. |
   | `distribute-to-issues` | Too large for one build | Hand the returned `issues` to [`/to-issues`](../to-issues/SKILL.md); do not implement here. |

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

## Disciplines (enforced inside every phase agent)

These are injected into every leaf prompt by the engine; restated so you can
audit them:

- **Escalation discipline.** Before flagging anything as needing a human, the
  agent checks `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `CONTEXT.md`,
  `docs/adr/`, `docs/`, and prior `.loop-swe/` artifacts. Only genuinely
  unanswered questions reach you.
- **Leaf-only.** No agent spawns another agent.
- **Adversarial verification.** Every review finding is independently verified
  against the diff before it can cost an implement round.

## Files

```
.apm/skills/loop-full-swe/
├── SKILL.md      ← this file
└── loop-swe.js   ← the shared engine (also launched by the 3 stage skills)
```

Artifacts for a run live under `<repo>/.loop-swe/`. Add `.loop-swe/` to
`.gitignore` if you do not want them in version control.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
The phase agents invoke these via the `Skill` tool:

- Skills: `e2e-validate`, `improve-codebase-architecture`,
  `improve-DDD-architecture`, `design-critique`, `diagnose`,
  `electron-visual-loop`, `web-visual-loop`, `to-issues`.
- Plugins: `ui-ux-pro-max`, `frontend-design`.
